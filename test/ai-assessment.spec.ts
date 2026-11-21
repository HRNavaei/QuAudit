import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  BadGatewayException,
} from "@nestjs/common";
import { AssignmentStatus, Role, QuestionType } from "@prisma/client";
import { AiService } from "../src/ai/ai.service";
import { AssignmentsService } from "../src/assignments/assignments.service";

describe("AI Supplier Assessment Feature", () => {
  let aiService: AiService;
  let assignmentsService: AssignmentsService;
  let prismaService: any;
  let mockOpenAIClient: any;
  let mockConfigService: any;
  let mockNotificationsService: any;

  beforeEach(() => {
    mockOpenAIClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "AI_API_KEY") return "test-api-key";
        if (key === "AI_BASE_URL") return "https://1xai.ir/v1";
        if (key === "AI_MODEL") return "gpt-4o-mini";
        return null;
      }),
    };

    prismaService = {
      questionnaireAssignment: {
        findUnique: jest.fn(),
      },
      supplier: {
        findUnique: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      questionnaire: {
        findUnique: jest.fn(),
      },
    };

    mockNotificationsService = {
      createNotification: jest.fn(),
    };

    aiService = new AiService(mockConfigService);
    aiService.setOpenAIClient(mockOpenAIClient);

    assignmentsService = new AssignmentsService(
      prismaService,
      mockNotificationsService,
      aiService,
    );
  });

  // =========================================================================
  // 1. AiService Unit & Parsing Tests
  // =========================================================================
  describe("AiService", () => {
    const validContext = {
      questionnaireTitle: "ISO 9001 Supplier Audit",
      questionnaireDescription: "Quality management audit",
      supplierCompanyName: "Acme Industrial",
      productName: "Precision Valve",
      productCategory: "Mechanical",
      questionsAndAnswers: [
        {
          questionOrder: 1,
          questionText: "Do you have an ISO 9001 certified QMS?",
          questionType: "YES_NO",
          isRequired: true,
          answer: "Yes",
        },
        {
          questionOrder: 2,
          questionText: "How often are internal quality audits conducted?",
          questionType: "SINGLE_CHOICE",
          isRequired: true,
          answer: "Quarterly (quarterly)",
        },
        {
          questionOrder: 3,
          questionText: "What is your defect rate in parts per million (PPM)?",
          questionType: "NUMBER",
          isRequired: false,
          answer: "15",
        },
      ],
    };

    it("should successfully generate and validate a structured assessment", async () => {
      const mockAiOutput = {
        score: 88,
        label: "Good",
        summary:
          "Acme Industrial demonstrates strong compliance with regular quarterly audits and ISO certification.",
        concerns: ["Defect rate could be tracked more granularly across sub-components."],
        recommendations: [
          "Maintain quarterly internal audits.",
          "Implement real-time defect rate tracking per production line.",
        ],
        disclaimer:
          "This is an AI-generated assessment and should not be treated as a verified compliance rating.",
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockAiOutput) } }],
      });

      const result = await aiService.assessSupplierSubmission(validContext);

      expect(result).toBeDefined();
      expect(result.score).toBe(88);
      expect(result.label).toBe("Good");
      expect(result.summary).toContain("Acme Industrial");
      expect(result.concerns).toHaveLength(1);
      expect(result.recommendations).toHaveLength(2);
      expect(result.disclaimer).toContain("AI-generated assessment");

      // Verify that OpenAI was called with correct parameters
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      );
    });

    it("should clamp scores outside 0-100 range and limit concerns/recommendations to max 3", async () => {
      const mockOverflowOutput = {
        score: 150, // Should be clamped to 100
        label: "Super",
        summary: "Excellent responses.",
        concerns: ["Issue 1", "Issue 2", "Issue 3", "Issue 4", "Issue 5"],
        recommendations: ["Rec 1", "Rec 2", "Rec 3", "Rec 4"],
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockOverflowOutput) } }],
      });

      const result = await aiService.assessSupplierSubmission(validContext);

      expect(result.score).toBe(100);
      expect(result.concerns).toHaveLength(3);
      expect(result.recommendations).toHaveLength(3);
      expect(result.disclaimer).toBe(
        "This is an AI-generated assessment and should not be treated as a verified compliance rating.",
      );
    });

    it("should throw ServiceUnavailableException if AI_API_KEY is not configured", async () => {
      const unconfiguredAiService = new AiService({
        get: jest.fn(() => null),
      } as any);

      await expect(
        unconfiguredAiService.assessSupplierSubmission(validContext),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it("should throw BadGatewayException when AI provider returns malformed JSON", async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: "Malformed non-JSON output from LLM {" } }],
      });

      await expect(
        aiService.assessSupplierSubmission(validContext),
      ).rejects.toThrow(BadGatewayException);
    });

    it("should throw BadGatewayException on AI provider timeout", async () => {
      const timeoutError: any = new Error("Connection timed out");
      timeoutError.name = "APIConnectionTimeoutError";
      mockOpenAIClient.chat.completions.create.mockRejectedValueOnce(timeoutError);

      await expect(
        aiService.assessSupplierSubmission(validContext),
      ).rejects.toThrow(BadGatewayException);
    });

    it("should throw BadGatewayException on AI provider HTTP error", async () => {
      const apiError: any = new Error("Rate limit exceeded");
      apiError.name = "RateLimitError";
      apiError.status = 429;
      mockOpenAIClient.chat.completions.create.mockRejectedValueOnce(apiError);

      await expect(
        aiService.assessSupplierSubmission(validContext),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  // =========================================================================
  // 2. AssignmentsService Authorization & Workflow Tests
  // =========================================================================
  describe("AssignmentsService.generateAiAssessment", () => {
    const adminUser = {
      userId: "00000000-0000-0000-0000-000000000001",
      email: "admin@example.com",
      role: Role.ADMIN,
    };

    const supervisorUser = {
      userId: "00000000-0000-0000-0000-000000000002",
      email: "supervisor@example.com",
      role: Role.SUPERVISOR,
    };

    const supplierUser = {
      userId: "00000000-0000-0000-0000-000000000003",
      email: "supplier@example.com",
      role: Role.SUPPLIER,
    };

    const assignmentId = "11111111-1111-1111-1111-111111111111";

    it("should reject unauthorized access by SUPPLIER role with ForbiddenException", async () => {
      await expect(
        assignmentsService.generateAiAssessment(assignmentId, supplierUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if assignment does not exist", async () => {
      prismaService.questionnaireAssignment.findUnique.mockResolvedValueOnce(null);

      await expect(
        assignmentsService.generateAiAssessment(assignmentId, supervisorUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should reject assessment if assignment status is PENDING", async () => {
      prismaService.questionnaireAssignment.findUnique.mockResolvedValueOnce({
        id: assignmentId,
        status: AssignmentStatus.PENDING,
        questionnaire: { questions: [] },
        supplier: { companyName: "Beta Corp" },
        answers: [],
      });

      await expect(
        assignmentsService.generateAiAssessment(assignmentId, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject assessment if assignment status is IN_PROGRESS", async () => {
      prismaService.questionnaireAssignment.findUnique.mockResolvedValueOnce({
        id: assignmentId,
        status: AssignmentStatus.IN_PROGRESS,
        questionnaire: { questions: [] },
        supplier: { companyName: "Beta Corp" },
        answers: [],
      });

      await expect(
        assignmentsService.generateAiAssessment(assignmentId, supervisorUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("should send only the requested assignment's answers to the AI service", async () => {
      const mockAssignment = {
        id: assignmentId,
        status: AssignmentStatus.SUBMITTED,
        questionnaire: {
          title: "Safety Assessment",
          description: "Workplace safety audit",
          questions: [
            {
              id: "q1",
              order: 1,
              text: "Are safety goggles mandatory?",
              type: QuestionType.YES_NO,
              isRequired: true,
              options: [],
            },
            {
              id: "q2",
              order: 2,
              text: "Describe emergency evacuation plan:",
              type: QuestionType.TEXT,
              isRequired: true,
              options: [],
            },
          ],
        },
        supplier: {
          companyName: "SafeTech Ltd",
        },
        product: {
          name: "Protective Helmet",
          category: "PPE",
        },
        answers: [
          {
            assignmentId,
            questionId: "q1",
            booleanValue: true,
          },
          {
            assignmentId,
            questionId: "q2",
            textValue: "Evacuation map posted on all exit doors with annual drills.",
          },
        ],
      };

      prismaService.questionnaireAssignment.findUnique.mockResolvedValueOnce(mockAssignment);

      const assessSpy = jest.spyOn(aiService, "assessSupplierSubmission").mockResolvedValueOnce({
        score: 95,
        label: "Excellent",
        summary: "Clear evacuation procedures and full mandatory safety compliance.",
        concerns: [],
        recommendations: ["Continue annual evacuation drill frequency."],
        disclaimer: "This is an AI-generated assessment and should not be treated as a verified compliance rating.",
      });

      const assessment = await assignmentsService.generateAiAssessment(assignmentId, supervisorUser);

      expect(assessment).toBeDefined();
      expect(assessment.score).toBe(95);
      expect(assessSpy).toHaveBeenCalledTimes(1);

      // Verify the payload passed to assessSupplierSubmission:
      const passedContext = assessSpy.mock.calls[0][0];
      expect(passedContext.questionnaireTitle).toBe("Safety Assessment");
      expect(passedContext.supplierCompanyName).toBe("SafeTech Ltd");
      expect(passedContext.productName).toBe("Protective Helmet");
      expect(passedContext.questionsAndAnswers).toHaveLength(2);
      expect(passedContext.questionsAndAnswers[0].answer).toBe("Yes");
      expect(passedContext.questionsAndAnswers[1].answer).toContain("Evacuation map");

      // Verify that no user emails or personal info were included in the context:
      expect((passedContext as any).email).toBeUndefined();
      expect((passedContext as any).user).toBeUndefined();
    });
  });
});
