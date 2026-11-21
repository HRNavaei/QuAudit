import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { AiAssessmentResponseDto } from "./dto/ai-assessment-response.dto";

export interface QuestionAnswerContext {
  questionOrder: number;
  questionText: string;
  questionType: string;
  isRequired: boolean;
  answer: string | null;
}

export interface SupplierAssessmentContext {
  questionnaireTitle: string;
  questionnaireDescription?: string | null;
  supplierCompanyName: string;
  productName?: string | null;
  productCategory?: string | null;
  questionsAndAnswers: QuestionAnswerContext[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openaiClient: OpenAI | null = null;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("AI_API_KEY");
    this.baseUrl =
      this.configService.get<string>("AI_BASE_URL") || "https://1xai.ir/v1";
    this.model = this.configService.get<string>("AI_MODEL") || "gpt-4o-mini";

    if (this.apiKey && this.apiKey !== "your-ai-api-key-here") {
      this.openaiClient = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        timeout: 30000,
        maxRetries: 2,
      });
    }
  }

  // Method to allow injecting / overriding client for unit testing
  setOpenAIClient(client: OpenAI | null) {
    this.openaiClient = client;
  }

  async assessSupplierSubmission(
    context: SupplierAssessmentContext,
  ): Promise<AiAssessmentResponseDto> {
    if (!this.openaiClient) {
      // Check if newly configured in environment
      const currentKey = this.configService.get<string>("AI_API_KEY");
      if (!currentKey || currentKey === "your-ai-api-key-here") {
        throw new ServiceUnavailableException(
          "AI service is not configured. Please set a valid AI_API_KEY in the environment.",
        );
      }
      this.openaiClient = new OpenAI({
        apiKey: currentKey,
        baseURL: this.baseUrl,
        timeout: 30000,
        maxRetries: 2,
      });
    }

    const systemPrompt = `You are an expert supplier audit, quality assurance, and compliance assessment assistant.
Your task is to analyze a supplier's submitted questionnaire responses and provide a structured, objective, indicative assessment.

CRITICAL INSTRUCTIONS:
1. Base your evaluation EXCLUSIVELY on the provided questionnaire prompt and submitted answers.
2. Do NOT invent, assume, or hallucinate missing information.
3. Do NOT treat unanswered or omitted optional questions as negative evidence.
4. Calculate an indicative score from 0 to 100 based strictly on the quality, completeness, and compliance level demonstrated in the answers.
5. Provide an indicative label: "Excellent" (90-100), "Good" (75-89), "Satisfactory" (60-74), "Needs Improvement" (40-59), or "Critical Risk" (0-39).
6. Provide a concise summary (2-4 sentences) evaluating the supplier's responses.
7. Identify up to three (0 to 3) notable weaknesses, risks, or potentially concerning answers.
8. Provide up to three (0 to 3) practical, actionable recommendations for improvement.
9. Always include the standard disclaimer: "This is an AI-generated assessment and should not be treated as a verified compliance rating."
10. Return ONLY a valid JSON object matching the required schema.`;

    const userPrompt = JSON.stringify({
      questionnaire: {
        title: context.questionnaireTitle,
        description: context.questionnaireDescription || null,
      },
      supplier: {
        companyName: context.supplierCompanyName,
      },
      product: context.productName
        ? {
            name: context.productName,
            category: context.productCategory || null,
          }
        : null,
      items: context.questionsAndAnswers.map((qa) => ({
        order: qa.questionOrder,
        question: qa.questionText,
        type: qa.questionType,
        required: qa.isRequired,
        submittedAnswer: qa.answer !== null ? qa.answer : "(Unanswered)",
      })),
    });

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const choice = response.choices?.[0]?.message?.content;
      if (!choice) {
        throw new BadGatewayException("AI service returned an empty response");
      }

      return this.validateAndNormalizeResponse(choice);
    } catch (error: any) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      this.logger.error(
        `AI assessment request failed: ${error?.message || error}`,
      );

      // Handle specific OpenAI SDK error types
      if (
        error?.name === "APIConnectionTimeoutError" ||
        error?.code === "ETIMEDOUT"
      ) {
        throw new BadGatewayException(
          "AI service request timed out. Please try again later.",
        );
      }

      if (error?.name === "AuthenticationError" || error?.status === 401) {
        throw new BadGatewayException(
          "AI service authentication failed. Please check the AI provider API key.",
        );
      }

      if (error?.name === "RateLimitError" || error?.status === 429) {
        throw new BadGatewayException(
          "AI service rate limit exceeded. Please try again shortly.",
        );
      }

      throw new BadGatewayException(
        `AI service provider error: ${error?.message || "Failed to generate assessment"}`,
      );
    }
  }

  private validateAndNormalizeResponse(
    rawJson: string,
  ): AiAssessmentResponseDto {
    let parsed: any;
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      throw new BadGatewayException(
        "AI service returned a malformed response that could not be parsed as JSON",
      );
    }

    if (typeof parsed !== "object" || parsed === null) {
      throw new BadGatewayException(
        "AI service response did not return a JSON object",
      );
    }

    // Validate score (must be numeric, between 0 and 100)
    const rawScore = Number(parsed.score);
    if (isNaN(rawScore)) {
      throw new BadGatewayException(
        "AI assessment response missing valid numeric score",
      );
    }
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    // Validate label
    const label =
      typeof parsed.label === "string" && parsed.label.trim().length > 0
        ? parsed.label.trim()
        : this.deriveLabelFromScore(score);

    // Validate summary
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : "Assessment generated based on submitted questionnaire answers.";

    // Validate concerns (array of strings, max 3)
    let concerns: string[] = [];
    if (Array.isArray(parsed.concerns)) {
      concerns = parsed.concerns
        .filter((c: any) => typeof c === "string" && c.trim().length > 0)
        .map((c: string) => c.trim())
        .slice(0, 3);
    }

    // Validate recommendations (array of strings, max 3)
    let recommendations: string[] = [];
    if (Array.isArray(parsed.recommendations)) {
      recommendations = parsed.recommendations
        .filter((r: any) => typeof r === "string" && r.trim().length > 0)
        .map((r: string) => r.trim())
        .slice(0, 3);
    }

    const disclaimer =
      typeof parsed.disclaimer === "string" && parsed.disclaimer.length > 0
        ? parsed.disclaimer
        : "This is an AI-generated assessment and should not be treated as a verified compliance rating.";

    return {
      score,
      label,
      summary,
      concerns,
      recommendations,
      disclaimer,
    };
  }

  private deriveLabelFromScore(score: number): string {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 60) return "Satisfactory";
    if (score >= 40) return "Needs Improvement";
    return "Critical Risk";
  }
}
