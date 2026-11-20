import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsEnum } from "class-validator";
import { QuestionnaireStatus } from "@prisma/client";

export class CreateQuestionnaireDto {
  @ApiProperty({ example: "Supplier Quality & Sustainability Audit 2026" })
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    example: "Annual questionnaire to assess quality standards and compliance.",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: QuestionnaireStatus,
    default: QuestionnaireStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(QuestionnaireStatus)
  status?: QuestionnaireStatus;
}
