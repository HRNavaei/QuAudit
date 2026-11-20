import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AssignmentStatus, QuestionType } from "@prisma/client";

export class AnswerResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  id!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440001" })
  assignmentId!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440002" })
  questionId!: string;

  @ApiPropertyOptional({ example: "Answer text", nullable: true })
  textValue!: string | null;

  @ApiPropertyOptional({ example: 100, nullable: true })
  numberValue!: number | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  booleanValue!: boolean | null;

  @ApiPropertyOptional({ example: "550e8400-e29b-41d4-a716-446655440003", nullable: true })
  selectedOptionId!: string | null;

  @ApiPropertyOptional({
    description: "Question details linked to this answer",
    required: false,
  })
  question?: {
    id: string;
    text: string;
    type: QuestionType;
    isRequired: boolean;
    order: number;
  };

  @ApiPropertyOptional({
    description: "Option details if an option was selected",
    required: false,
  })
  selectedOption?: {
    id: string;
    label: string;
    value: string;
  } | null;

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  updatedAt!: Date;
}

export class AssignmentResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440001" })
  id!: string;

  @ApiProperty({ enum: AssignmentStatus, example: AssignmentStatus.PENDING })
  status!: AssignmentStatus;

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  assignedAt!: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  submittedAt!: Date | null;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440002" })
  questionnaireId!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440003" })
  supplierId!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  productId!: string | null;

  @ApiPropertyOptional({ description: "Questionnaire metadata" })
  questionnaire?: {
    id: string;
    title: string;
    version: number;
    status: string;
  };

  @ApiPropertyOptional({ description: "Supplier company details" })
  supplier?: {
    id: string;
    companyName: string;
    userId: string;
  };

  @ApiPropertyOptional({ description: "Product details if assigned per product" })
  product?: {
    id: string;
    name: string;
    category: string | null;
  } | null;

  @ApiPropertyOptional({
    type: [AnswerResponseDto],
    description: "Submitted answers for this assignment",
  })
  answers?: AnswerResponseDto[];

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  updatedAt!: Date;
}
