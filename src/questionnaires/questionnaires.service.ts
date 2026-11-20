import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateQuestionnaireDto } from "./dto/create-questionnaire.dto";
import { UpdateQuestionnaireDto } from "./dto/update-questionnaire.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { CreateOptionDto } from "./dto/create-option.dto";
import { UpdateOptionDto } from "./dto/update-option.dto";
import { RequestUser } from "../auth/current-user.decorator";
import { QuestionnaireStatus, Role } from "@prisma/client";

@Injectable()
export class QuestionnairesService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestionnaire(dto: CreateQuestionnaireDto, createdById: string) {
    return this.prisma.questionnaire.create({
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
  }

  async findAll(user: RequestUser, status?: QuestionnaireStatus) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    if (user.role === Role.SUPPLIER) {
      // Suppliers can only view questionnaires that are PUBLISHED or assigned to them
      const supplier = await this.prisma.supplier.findUnique({
        where: { userId: user.userId },
      });
      if (!supplier) {
        where.status = QuestionnaireStatus.PUBLISHED;
      } else {
        where.OR = [
          { status: QuestionnaireStatus.PUBLISHED },
          { assignments: { some: { supplierId: supplier.id } } },
        ];
      }
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
      if (questionnaire.status !== QuestionnaireStatus.PUBLISHED) {
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
            "Suppliers can only access published or assigned questionnaires",
          );
        }
      }
    }

    return questionnaire;
  }

  async updateQuestionnaire(id: string, dto: UpdateQuestionnaireDto) {
    const existing = await this.prisma.questionnaire.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }

    return this.prisma.questionnaire.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        questions: {
          include: { options: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
    });
  }

  async deleteQuestionnaire(id: string) {
    const existing = await this.prisma.questionnaire.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }

    return this.prisma.questionnaire.delete({
      where: { id },
    });
  }

  async createVersion(id: string, createdById: string) {
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

    // Create new version in a transaction
    return this.prisma.$transaction(async (tx) => {
      const newQuestionnaire = await tx.questionnaire.create({
        data: {
          title: parent.title,
          description: parent.description,
          status: QuestionnaireStatus.DRAFT,
          version: parent.version + 1,
          parentId: parent.id,
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
      throw new NotFoundException(`Questionnaire with ID ${questionnaireId} not found`);
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

  async updateQuestion(questionnaireId: string, questionId: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, questionnaireId },
    });
    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found in questionnaire ${questionnaireId}`);
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
    });
    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found in questionnaire ${questionnaireId}`);
    }

    return this.prisma.question.delete({
      where: { id: questionId },
    });
  }

  // --- Question Options Management ---

  async addOption(questionnaireId: string, questionId: string, dto: CreateOptionDto) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, questionnaireId },
    });
    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found in questionnaire ${questionnaireId}`);
    }

    if (dto.followUpQuestionId) {
      // Validate follow-up question belongs to the same questionnaire
      const followUp = await this.prisma.question.findFirst({
        where: { id: dto.followUpQuestionId, questionnaireId },
      });
      if (!followUp) {
        throw new BadRequestException("Follow-up question must belong to the same questionnaire");
      }
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
    });
    if (!option) {
      throw new NotFoundException(`Option ${optionId} not found for question ${questionId}`);
    }

    if (dto.followUpQuestionId) {
      const followUp = await this.prisma.question.findFirst({
        where: { id: dto.followUpQuestionId, questionnaireId },
      });
      if (!followUp) {
        throw new BadRequestException("Follow-up question must belong to the same questionnaire");
      }
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

  async deleteOption(questionnaireId: string, questionId: string, optionId: string) {
    const option = await this.prisma.questionOption.findFirst({
      where: { id: optionId, questionId, question: { questionnaireId } },
    });
    if (!option) {
      throw new NotFoundException(`Option ${optionId} not found for question ${questionId}`);
    }

    return this.prisma.questionOption.delete({
      where: { id: optionId },
    });
  }
}
