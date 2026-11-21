import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AiService } from "../ai/ai.service";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { UpdateAssignmentStatusDto } from "./dto/update-assignment-status.dto";
import { SaveAnswersDto } from "./dto/save-answers.dto";
import { RequestUser } from "../auth/current-user.decorator";
import { AssignmentStatus, Role, QuestionnaireStatus } from "@prisma/client";

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly aiService: AiService,
  ) {}

  async createAssignment(dto: CreateAssignmentDto, creatorId: string) {
    // 1. Verify questionnaire exists and is published
    const questionnaire = await this.prisma.questionnaire.findUnique({
      where: { id: dto.questionnaireId },
    });
    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire with ID ${dto.questionnaireId} not found`);
    }
    if (questionnaire.status !== QuestionnaireStatus.PUBLISHED) {
      throw new BadRequestException("Only PUBLISHED questionnaires can be assigned to suppliers");
    }

    // 2. Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${dto.supplierId} not found`);
    }

    // 3. Verify product if provided
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID ${dto.productId} not found`);
      }
      if (product.supplierId !== dto.supplierId) {
        throw new BadRequestException("Product does not belong to the assigned supplier");
      }
    }

    // 4. Duplicate prevention
    const existing = await this.prisma.questionnaireAssignment.findFirst({
      where: {
        questionnaireId: dto.questionnaireId,
        supplierId: dto.supplierId,
        productId: dto.productId || null,
      },
    });
    if (existing) {
      throw new ConflictException(
        "An assignment for this questionnaire, supplier, and product combination already exists",
      );
    }

    // 5. Create assignment
    const assignment = await this.prisma.questionnaireAssignment.create({
      data: {
        questionnaireId: dto.questionnaireId,
        supplierId: dto.supplierId,
        productId: dto.productId || null,
        status: AssignmentStatus.PENDING,
      },
      include: {
        questionnaire: {
          select: { id: true, title: true, version: true, status: true },
        },
        supplier: {
          select: { id: true, companyName: true, userId: true },
        },
        product: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    // 6. In-app notification to the supplier user
    await this.notificationsService.createNotification({
      senderId: creatorId,
      receiverId: supplier.userId,
      title: "New Questionnaire Assigned",
      message: `You have been assigned the questionnaire: "${questionnaire.title}".`,
      type: "ASSIGNMENT",
    });

    return assignment;
  }

  async findAll(
    user: RequestUser,
    filters: {
      supplierId?: string;
      productId?: string;
      questionnaireId?: string;
      status?: AssignmentStatus;
    },
  ) {
    const where: any = {};

    if (user.role === Role.SUPPLIER) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { userId: user.userId },
      });
      if (!supplier) {
        return [];
      }
      where.supplierId = supplier.id;
    } else {
      if (filters.supplierId) where.supplierId = filters.supplierId;
    }

    if (filters.productId) where.productId = filters.productId;
    if (filters.questionnaireId) where.questionnaireId = filters.questionnaireId;
    if (filters.status) where.status = filters.status;

    return this.prisma.questionnaireAssignment.findMany({
      where,
      include: {
        questionnaire: {
          select: { id: true, title: true, version: true, status: true },
        },
        supplier: {
          select: { id: true, companyName: true, userId: true },
        },
        product: {
          select: { id: true, name: true, category: true },
        },
        _count: {
          select: { answers: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const assignment = await this.prisma.questionnaireAssignment.findUnique({
      where: { id },
      include: {
        questionnaire: {
          include: {
            questions: {
              include: {
                options: { orderBy: { order: "asc" } },
              },
              orderBy: { order: "asc" },
            },
          },
        },
        supplier: {
          select: { id: true, companyName: true, userId: true },
        },
        product: {
          select: { id: true, name: true, category: true },
        },
        answers: {
          include: {
            question: true,
            selectedOption: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${id} not found`);
    }

    if (user.role === Role.SUPPLIER && assignment.supplier.userId !== user.userId) {
      throw new ForbiddenException("Cannot access assignments belonging to another supplier");
    }

    return assignment;
  }

  async updateStatus(id: string, dto: UpdateAssignmentStatusDto, user: RequestUser) {
    const assignment = await this.findOne(id, user);

    return this.prisma.questionnaireAssignment.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === AssignmentStatus.SUBMITTED && !assignment.submittedAt
          ? { submittedAt: new Date() }
          : {}),
      },
      include: {
        questionnaire: { select: { id: true, title: true } },
        supplier: { select: { id: true, companyName: true } },
      },
    });
  }

  async saveAnswers(assignmentId: string, dto: SaveAnswersDto, user: RequestUser) {
    const assignment = await this.findOne(assignmentId, user);

    // Lock check: submitted assignments cannot be modified
    if (assignment.status === AssignmentStatus.SUBMITTED) {
      throw new BadRequestException(
        "Cannot modify answers for a submitted assignment. Please ask a supervisor to re-open it.",
      );
    }

    // Validate that questions belong to the assignment's questionnaire
    const validQuestions = new Map<string, any>(
      assignment.questionnaire.questions.map((q) => [q.id, q]),
    );

    for (const ans of dto.answers) {
      const q = validQuestions.get(ans.questionId);
      if (!q) {
        throw new BadRequestException(
          `Question ${ans.questionId} does not belong to questionnaire ${assignment.questionnaireId}`,
        );
      }

      if (ans.selectedOptionId) {
        const optionValid = q.options.some((opt: any) => opt.id === ans.selectedOptionId);
        if (!optionValid) {
          throw new BadRequestException(
            `Option ${ans.selectedOptionId} does not belong to question ${ans.questionId}`,
          );
        }
      }
    }

    // Save or update answers in a transaction
    return this.prisma.$transaction(async (tx) => {
      for (const ans of dto.answers) {
        const existingAnswer = await tx.answer.findFirst({
          where: {
            assignmentId,
            questionId: ans.questionId,
          },
        });

        if (existingAnswer) {
          await tx.answer.update({
            where: { id: existingAnswer.id },
            data: {
              textValue: ans.textValue ?? null,
              numberValue: ans.numberValue ?? null,
              booleanValue: ans.booleanValue ?? null,
              selectedOptionId: ans.selectedOptionId ?? null,
            },
          });
        } else {
          await tx.answer.create({
            data: {
              assignmentId,
              questionId: ans.questionId,
              textValue: ans.textValue ?? null,
              numberValue: ans.numberValue ?? null,
              booleanValue: ans.booleanValue ?? null,
              selectedOptionId: ans.selectedOptionId ?? null,
            },
          });
        }
      }

      // Automatically transition from PENDING to IN_PROGRESS upon saving answers
      if (assignment.status === AssignmentStatus.PENDING) {
        await tx.questionnaireAssignment.update({
          where: { id: assignmentId },
          data: { status: AssignmentStatus.IN_PROGRESS },
        });
      }

      // Clean up orphaned answers on inactive/hidden branches
      const allAssignmentAnswers = await tx.answer.findMany({ where: { assignmentId } });
      const visibleIds = this.getVisibleQuestionIds(assignment.questionnaire.questions, allAssignmentAnswers);
      const toDelete = allAssignmentAnswers.filter((a) => !visibleIds.has(a.questionId));
      if (toDelete.length > 0) {
        await tx.answer.deleteMany({
          where: { id: { in: toDelete.map((a) => a.id) } },
        });
      }

      return tx.answer.findMany({
        where: { assignmentId },
        include: { question: true, selectedOption: true },
      });
    });
  }

  private getVisibleQuestionIds(
    questions: any[],
    answers: { questionId: string; selectedOptionId?: string | null }[],
  ): Set<string> {
    const incomingTargets = new Set<string>();
    for (const q of questions) {
      for (const opt of q.options || []) {
        if (opt.followUpQuestionId) {
          incomingTargets.add(opt.followUpQuestionId);
        }
      }
    }

    const answerMap = new Map<string, string | undefined | null>();
    for (const ans of answers) {
      answerMap.set(ans.questionId, ans.selectedOptionId);
    }

    const activeTriggeredIds = new Set<string>();

    const activateFollowUps = (questionId: string) => {
      const q = questions.find((item) => item.id === questionId);
      if (!q) return;

      const selectedOptionId = answerMap.get(questionId);
      if (selectedOptionId && q.options) {
        const selectedOpt = q.options.find((o: any) => o.id === selectedOptionId);
        if (selectedOpt?.followUpQuestionId) {
          activeTriggeredIds.add(selectedOpt.followUpQuestionId);
          activateFollowUps(selectedOpt.followUpQuestionId);
        }
      }
    };

    for (const q of questions) {
      if (!incomingTargets.has(q.id)) {
        activateFollowUps(q.id);
      }
    }

    const visibleIds = new Set<string>();
    for (const q of questions) {
      if (!incomingTargets.has(q.id) || activeTriggeredIds.has(q.id)) {
        visibleIds.add(q.id);
      }
    }

    return visibleIds;
  }

  async submitAssignment(assignmentId: string, user: RequestUser) {
    const assignment = await this.findOne(assignmentId, user);

    if (assignment.status === AssignmentStatus.SUBMITTED) {
      throw new BadRequestException("Assignment has already been submitted");
    }

    // Verify required questions have answers among visible questions
    const answers = await this.prisma.answer.findMany({
      where: { assignmentId },
    });
    const answeredQuestionIds = new Set(
      answers
        .filter((a) => {
          if (a.selectedOptionId) return true;
          if (a.numberValue !== null && a.numberValue !== undefined) return true;
          if (a.textValue !== null && a.textValue !== undefined && a.textValue.trim().length > 0) return true;
          if (a.booleanValue !== null && a.booleanValue !== undefined) return true;
          return false;
        })
        .map((a) => a.questionId),
    );

    const visibleQuestionIds = this.getVisibleQuestionIds(
      assignment.questionnaire.questions,
      answers,
    );

    const missingRequired = assignment.questionnaire.questions.filter(
      (q) => q.isRequired && visibleQuestionIds.has(q.id) && !answeredQuestionIds.has(q.id),
    );

    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Required questions missing answers: ${missingRequired.map((q) => q.text).join(", ")}`,
      );
    }

    const updated = await this.prisma.questionnaireAssignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: {
        questionnaire: { select: { id: true, title: true } },
        supplier: { select: { id: true, companyName: true } },
      },
    });

    // Notify questionnaire creator
    await this.notificationsService.createNotification({
      senderId: user.userId,
      receiverId: assignment.questionnaire.createdById,
      title: "Questionnaire Response Submitted",
      message: `Supplier "${assignment.supplier.companyName}" submitted response for "${assignment.questionnaire.title}".`,
      type: "SUBMISSION",
    });

    return updated;
  }

  async reopenAssignment(assignmentId: string) {
    const assignment = await this.prisma.questionnaireAssignment.findUnique({
      where: { id: assignmentId },
      include: { supplier: true, questionnaire: true },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
    }

    const updated = await this.prisma.questionnaireAssignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.IN_PROGRESS,
        submittedAt: null,
      },
    });

    // Notify supplier that assignment was re-opened
    await this.notificationsService.createNotification({
      senderId: assignment.questionnaire.createdById,
      receiverId: assignment.supplier.userId,
      title: "Questionnaire Re-opened",
      message: `Your assignment for "${assignment.questionnaire.title}" has been re-opened for resubmission.`,
      type: "REOPENED",
    });

    return updated;
  }

  async deleteAssignment(id: string) {
    const existing = await this.prisma.questionnaireAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Assignment with ID ${id} not found`);
    }
    return this.prisma.questionnaireAssignment.delete({ where: { id } });
  }

  // --- Option B: Essential Response Inspection for Supervisors/Admins ---

  async getResponsesByQuestionnaire(questionnaireId: string) {
    const questionnaire = await this.prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
      include: {
        questions: {
          include: { options: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire with ID ${questionnaireId} not found`);
    }

    const assignments = await this.prisma.questionnaireAssignment.findMany({
      where: {
        questionnaireId,
        status: AssignmentStatus.SUBMITTED,
      },
      include: {
        supplier: {
          select: { id: true, companyName: true, phone: true, address: true },
        },
        product: {
          select: { id: true, name: true, category: true },
        },
        answers: {
          include: {
            question: true,
            selectedOption: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    return {
      questionnaire: {
        id: questionnaire.id,
        title: questionnaire.title,
        version: questionnaire.version,
        status: questionnaire.status,
      },
      totalSubmissions: assignments.length,
      submissions: assignments,
    };
  }

  // --- AI Supplier Assessment ---

  async generateAiAssessment(id: string, user: RequestUser) {
    if (user.role !== Role.ADMIN && user.role !== Role.SUPERVISOR) {
      throw new ForbiddenException(
        "Only SUPERVISOR and ADMIN roles can request AI assessments",
      );
    }

    const assignment = await this.prisma.questionnaireAssignment.findUnique({
      where: { id },
      include: {
        questionnaire: {
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: {
                options: { orderBy: { order: "asc" } },
              },
            },
          },
        },
        supplier: {
          select: { id: true, companyName: true },
        },
        product: {
          select: { id: true, name: true, category: true },
        },
        answers: {
          where: { assignmentId: id },
          include: {
            question: true,
            selectedOption: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${id} not found`);
    }

    if (assignment.status !== AssignmentStatus.SUBMITTED) {
      throw new BadRequestException(
        `AI assessment can only be generated for submitted assignments. Current status is ${assignment.status}`,
      );
    }

    const answerMap = new Map<string, any>(
      assignment.answers.map((a) => [a.questionId, a]),
    );

    const questionsAndAnswers = assignment.questionnaire.questions.map((q) => {
      const ans = answerMap.get(q.id);
      let answerStr: string | null = null;
      if (ans) {
        if (ans.selectedOption) {
          answerStr = `${ans.selectedOption.label} (${ans.selectedOption.value})`;
        } else if (ans.booleanValue !== null && ans.booleanValue !== undefined) {
          answerStr = ans.booleanValue ? "Yes" : "No";
        } else if (ans.numberValue !== null && ans.numberValue !== undefined) {
          answerStr = String(ans.numberValue);
        } else if (ans.textValue !== null && ans.textValue !== undefined) {
          answerStr = ans.textValue;
        }
      }

      return {
        questionOrder: q.order,
        questionText: q.text,
        questionType: q.type,
        isRequired: q.isRequired,
        answer: answerStr,
      };
    });

    return this.aiService.assessSupplierSubmission({
      questionnaireTitle: assignment.questionnaire.title,
      questionnaireDescription: assignment.questionnaire.description,
      supplierCompanyName: assignment.supplier.companyName,
      productName: assignment.product?.name,
      productCategory: assignment.product?.category,
      questionsAndAnswers,
    });
  }
}
