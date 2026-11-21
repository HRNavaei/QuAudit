import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { QuestionnaireStatus, QuestionType } from "@prisma/client";

export class QuestionOptionResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  id!: string;

  @ApiProperty({ example: "Yes" })
  label!: string;

  @ApiProperty({ example: "YES" })
  value!: string;

  @ApiProperty({ example: 0 })
  order!: number;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440001" })
  questionId!: string;

  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440002", nullable: true })
  followUpQuestionId!: string | null;

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  createdAt!: Date;
}

export class QuestionResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440001" })
  id!: string;

  @ApiProperty({ example: "Does your company have ISO 9001 certification?" })
  text!: string;

  @ApiProperty({ enum: QuestionType, example: QuestionType.YES_NO })
  type!: QuestionType;

  @ApiProperty({ example: true })
  isRequired!: boolean;

  @ApiProperty({ example: 0 })
  order!: number;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440003" })
  questionnaireId!: string;

  @ApiProperty({ type: [QuestionOptionResponseDto], required: false })
  options?: QuestionOptionResponseDto[];

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  updatedAt!: Date;
}

export class QuestionnaireResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440003" })
  id!: string;

  @ApiProperty({ example: "Supplier Quality & Sustainability Audit 2026" })
  title!: string;

  @ApiPropertyOptional({ example: "Annual questionnaire description", nullable: true })
  description!: string | null;

  @ApiProperty({ enum: QuestionnaireStatus, example: QuestionnaireStatus.DRAFT })
  status!: QuestionnaireStatus;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440004" })
  createdById!: string;

  @ApiProperty({ type: [QuestionResponseDto], required: false })
  questions?: QuestionResponseDto[];

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  updatedAt!: Date;
}
