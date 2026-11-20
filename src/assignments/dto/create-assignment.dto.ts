import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID, IsOptional } from "class-validator";

export class CreateAssignmentDto {
  @ApiProperty({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "Questionnaire UUID to be assigned",
  })
  @IsNotEmpty()
  @IsUUID()
  questionnaireId!: string;

  @ApiProperty({
    example: "550e8400-e29b-41d4-a716-446655440001",
    description: "Supplier UUID to assign to",
  })
  @IsNotEmpty()
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional({
    example: "550e8400-e29b-41d4-a716-446655440002",
    description:
      "Optional Product UUID. If specified, the product MUST belong to the assigned supplier.",
  })
  @IsOptional()
  @IsUUID()
  productId?: string;
}
