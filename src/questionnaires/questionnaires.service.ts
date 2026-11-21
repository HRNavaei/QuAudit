import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateQuestionnaireDto } from "./dto/create-questionnaire.dto";
import { UpdateQuestionnaireDto } from "./dto/update-questionnaire.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { CreateOptionDto } from "./dto/create-option.dto";
import { UpdateOptionDto } from "./dto/update-option.dto";
import { RequestUser } from "../auth/current-user.decorator";
import { QuestionnaireStatus, Role, Prisma } from "@prisma/client";

@Injectable()
export class QuestionnairesService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestionnaire(dto: CreateQuestionnaireDto, createdById: string) {
    const existing = await this.prisma.questionnaire.findUnique({
      where: { title: dto.title },
    });
    if (existing) {
      throw new ConflictException(
        `A questionnaire with title '${dto.title}' already exists`,
      );
    }

    try {
      return await this.prisma.questionnaire.create({
        data: {
          title: dto.title,
          description: dto.description,
          status: dto.status || QuestionnaireStatus.DRAFT,
          createdById,
        },
        include: {
          questions: {
            include: { options: true },
            orderBy: { order: "asc" },
          },
        },
      });
    } catch (error: any) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002") ||
        error?.code === "P2002"
      ) {
        throw new ConflictException(
          `A questionnaire with title '${dto.title}' already exists`,
        );
      }
      throw error;
    }
  }

  async findAll(user: RequestUser, status?: QuestionnaireStatus) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    if (user.role === Role.SUPPLIER) {
      // Suppliers can only view questionnaires that are ASSIGNED to them
      const supplier = await this.prisma.supplier.findUnique({
        where: { userId: user.userId },
      });
      if (!supplier) {
        return [];
      }
      where.status = QuestionnaireStatus.ASSIGNED;
      where.assignments = { some: { supplierId: supplier.id } };
    }

    return this.prisma.questionnaire.findMany({
      where,
      include: {
        questions: {
          include: { options: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    const questionnaire = await this.prisma.questionnaire.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: { orderBy: { order: "asc" } },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }

    if (user.role === Role.SUPPLIER) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { userId: user.userId },
      });
      const hasAssignment = supplier
        ? await this.prisma.questionnaireAssignment.findFirst({
            where: { questionnaireId: id, supplierId: supplier.id },
          })
        : null;

      if (!hasAssignment) {
        throw new ForbiddenException(
          "Suppliers can only access questionnaires that are assigned to them",
        );
      }
    }

    return questionnaire;
  }

  async updateQuestionnaire(id: string, dto: UpdateQuestionnaireDto) {
    const existing = await this.prisma.questionnaire.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }

    if (existing.status === QuestionnaireStatus.ASSIGNED) {
      throw new BadRequestException(
        "Cannot modify questionnaire: assigned questionnaires are immutable.",
      );
    }

    if (dto.title && dto.title !== existing.title) {
      const duplicate = await this.prisma.questionnaire.findUnique({
        where: { title: dto.title },
      });
      if (duplicate) {
        throw new ConflictException(
          `A questionnaire with title '${dto.title}' already exists`,
        );
      }
    }

    try {
      return await this.prisma.questionnaire.update({
        where: { id },
        data: {
          ...(dto.title ? { title: dto.title } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.status ? { status: dto.status } : {}),
        },
        include: {
          questions: {
            include: { options: { orderBy: { order: "asc" } } },
            orderBy: { order: "asc" },
          },
        },
      });
    } catch (error: any) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002") ||
        error?.code === "P2002"
      ) {
        throw new ConflictException(
          `A questionnaire with title '${dto.title}' already exists`,
        );
      }
      throw error;
    }
  }

  async deleteQuestionnaire(id: string) {
    const existing = await this.prisma.questionnaire.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }

    if (existing.status === QuestionnaireStatus.ASSIGNED) {
      throw new BadRequestException(
        "Cannot delete an assigned questionnaire.",
      );
    }

    return this.prisma.questionnaire.delete({
      where: { id },
    });
  }

  async cloneQuestionnaire(id: string, createdById: string) {
    const parent = await this.prisma.questionnaire.findUnique({
      where: { id },
      include: {
        questions: {
          include: { options: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }

    if (parent.status !== QuestionnaireStatus.ASSIGNED) {
      throw new BadRequestException(
        "Only assigned questionnaires can be cloned. Draft questionnaires can be edited directly.",
      );
    }

    // Generate unique clone title: "Title (1)", "Title (2)", etc.
    const baseTitle = parent.title.replace(/\s*\(\d+\)$/, "");
    let counter = 1;
    let candidateTitle = `${baseTitle} (${counter})`;
    while (
      await this.prisma.questionnaire.findUnique({
        where: { title: candidateTitle },
      })
    ) {
      counter++;
      candidateTitle = `${baseTitle} (${counter})`;
    }

    // Deep clone questionnaire, questions, and options preserving conditional logic
    return this.prisma.$transaction(async (tx) => {
      const newQuestionnaire = await tx.questionnaire.create({
        data: {
          title: candidateTitle,
          description: parent.description,
          status: QuestionnaireStatus.DRAFT,
          createdById,
        },
      });

      // Map old question IDs to new question IDs for followUpQuestion links
      const questionIdMap = new Map<string, string>();

      // 1. Clone questions
      for (const oldQ of parent.questions) {
        const newQ = await tx.question.create({
          data: {
            text: oldQ.text,
            type: oldQ.type,
            isRequired: oldQ.isRequired,
            order: oldQ.order,
            questionnaireId: newQuestionnaire.id,
          },
        });
        questionIdMap.set(oldQ.id, newQ.id);
      }

      // 2. Clone options with mapped follow-up IDs
      for (const oldQ of parent.questions) {
        const newQuestionId = questionIdMap.get(oldQ.id)!;
        for (const oldOpt of oldQ.options) {
          const newFollowUpId = oldOpt.followUpQuestionId
            ? questionIdMap.get(oldOpt.followUpQuestionId) || null
            : null;

          await tx.questionOption.create({
            data: {
              label: oldOpt.label,
              value: oldOpt.value,
              order: oldOpt.order,
              questionId: newQuestionId,
              followUpQuestionId: newFollowUpId,
            },
          });
        }
      }

      return tx.questionnaire.findUnique({
        where: { id: newQuestionnaire.id },
        include: {
          questions: {
            include: { options: { orderBy: { order: "asc" } } },
            orderBy: { order: "asc" },
          },
        },
      });
    });
  }

  // --- Questions Management ---

  async addQuestion(questionnaireId: string, dto: CreateQuestionDto) {
    const questionnaire = await this.prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
    });
    if (!questionnaire) {
      throw new NotFoundException(
        `Questionnaire with ID ${questionnaireId} not found`,
      );
    }

    if (questionnaire.status === QuestionnaireStatus.ASSIGNED) {
      throw new BadRequestException(
        "Cannot add questions: assigned questionnaires are immutable.",
      );
    }

    return this.prisma.question.create({
      data: {
        text: dto.text,
        type: dto.type,
        isRequired: dto.isRequired !== undefined ? dto.isRequired : true,
        order: dto.order ?? 0,
        questionnaireId,
      },
      include: { options: true },
    });
  }

  async updateQuestion(
    questionnaireId: string,
    questionId: string,
    dto: UpdateQuestionDto,
  ) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, questionnaireId },
      include: { questionnaire: { select: { status: true } } },
    });
    if (!question) {
      throw new NotFoundException(
        `Question ${questionId} not found in questionnaire ${questionnaireId}`,
      );
    }

    if (question.questionnaire.status === QuestionnaireStatus.ASSIGNED) {
      throw new BadRequestException(
        "Cannot update questions: assigned questionnaires are immutable.",
      );
    }

    return this.prisma.question.update({
      where: { id: questionId },
      data: {
        ...(dto.text ? { text: dto.text } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
      include: { options: true },
    });
  }

  async deleteQuestion(questionnaireId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, questionnaireId },
      include: { questionnaire: { select: { status: true } } },
    });
    if (!question) {
      throw new NotFoundException(
        `Question ${questionId} not found in questionnaire ${questionnaireId}`,
      );
    }

    if (question.questionnaire.status === QuestionnaireStatus.ASSIGNED) {
      throw new BadRequestException(
        "Cannot delete questions: assigned questionnaires are immutable.",
      );
    }

    return this.prisma.question.delete({
      where: { id: questionId },
    });
  }

  // --- Question Options Management ---

  async addOption(
    questionnaireId: string,
    questionId: string,
    dto: CreateOptionDto,
  ) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, questionnaireId },
      include: { questionnaire: { select: { status: true } } },
    });
    if (!question) {
      throw new NotFoundException(
        `Question ${questionId} not found in questionnaire ${questionnaireId}`,
      );
    }

    if (question.questionnaire.status === QuestionnaireStatus.ASSIGNED) {
      throw new BadRequestException(
        "Cannot add options: assigned questionnaires are immutable.",
      );
    }

    if (dto.followUpQuestionId) {
      // Validate follow-up question belongs to the same questionnaire
      const followUp = await this.prisma.question.findFirst({
        where: { id: dto.followUpQuestionId, questionnaireId },
      });
      if (!followUp) {
        throw new BadRequestException(
          "Follow-up question must belong to the same questionnaire",
        );
      }

      await this.validateNoCircularDependency(
        questionnaireId,
        questionId,
        dto.followUpQuestionId,
      );
    }

    return this.prisma.questionOption.create({
      data: {
        label: dto.label,
        value: dto.value,
        order: dto.order ?? 0,
        questionId,
        followUpQuestionId: dto.followUpQuestionId || null,
      },
    });
  }

  async updateOption(
    questionnaireId: string,
    questionId: string,
    optionId: string,
    dto: UpdateOptionDto,
  ) {
    const option = await this.prisma.questionOption.findFirst({
      where: { id: optionId, questionId, question: { questionnaireId } },
      include: {
        question: {
          include: { questionnaire: { select: { status: true } } },
        },
      },
    });
    if (!option) {
      throw new NotFoundException(
        `Option ${optionId} not found for question ${questionId}`,
      );
    }

    if (option.question.questionnaire.status === QuestionnaireStatus.ASSIGNED) {
      throw new BadRequestException(
        "Cannot update options: assigned questionnaires are immutable.",
      );
    }

    if (dto.followUpQuestionId) {
      const followUp = await this.prisma.question.findFirst({
        where: { id: dto.followUpQuestionId, questionnaireId },
      });
      if (!followUp) {
        throw new BadRequestException(
          "Follow-up question must belong to the same questionnaire",
        );
      }

      await this.validateNoCircularDependency(
        questionnaireId,
        questionId,
        dto.followUpQuestionId,
        optionId,
      );
    }

    return this.prisma.questionOption.update({
      where: { id: optionId },
      data: {
        ...(dto.label ? { label: dto.label } : {}),
        ...(dto.value ? { value: dto.value } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.followUpQuestionId !== undefined
          ? { followUpQuestionId: dto.followUpQuestionId }
          : {}),
      },
    });
  }

  async deleteOption(
    questionnaireId: string,
    questionId: string,
    optionId: string,
  ) {
    const option = await this.prisma.questionOption.findFirst({
      where: { id: optionId, questionId, question: { questionnaireId } },
      include: {
        question: {
          include: { questionnaire: { select: { status: true } } },
        },
      },
    });
    if (!option) {
      throw new NotFoundException(
        `Option ${optionId} not found for question ${questionId}`,
      );
    }

    if (option.question.questionnaire.status === QuestionnaireStatus.ASSIGNED) {
      throw new BadRequestException(
        "Cannot delete options: assigned questionnaires are immutable.",
      );
    }

    return this.prisma.questionOption.delete({
      where: { id: optionId },
    });
  }

  private async validateNoCircularDependency(
    questionnaireId: string,
    sourceQuestionId: string,
    targetQuestionId: string,
    excludedOptionId?: string,
  ) {
    if (sourceQuestionId === targetQuestionId) {
      throw new BadRequestException(
        "A question cannot have itself as a follow-up question",
      );
    }

    const allQuestions = await this.prisma.question.findMany({
      where: { questionnaireId },
      include: { options: true },
    });

    const adj = new Map<string, string[]>();
    for (const q of allQuestions) {
      adj.set(q.id, []);
      for (const opt of q.options) {
        if (opt.id !== excludedOptionId && opt.followUpQuestionId) {
          adj.get(q.id)!.push(opt.followUpQuestionId);
        }
      }
    }

    // Add proposed edge: sourceQuestionId -> targetQuestionId
    adj.get(sourceQuestionId)?.push(targetQuestionId);

    // Check if targetQuestionId can reach sourceQuestionId
    const visited = new Set<string>();
    const stack = [targetQuestionId];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (curr === sourceQuestionId) {
        throw new BadRequestException(
          "Circular follow-up question dependency detected",
        );
      }
      if (!visited.has(curr)) {
        visited.add(curr);
        const neighbors = adj.get(curr) || [];
        for (const n of neighbors) {
          stack.push(n);
        }
      }
    }
  }
}
