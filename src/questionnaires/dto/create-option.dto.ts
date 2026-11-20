import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class CreateOptionDto {
  @ApiProperty({ example: "Yes" })
  @IsNotEmpty()
  @IsString()
  label!: string;

  @ApiProperty({ example: "YES" })
  @IsNotEmpty()
  @IsString()
  value!: string;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description:
      "Optional follow-up question ID that should appear when this option is selected. Must belong to the same questionnaire.",
  })
  @IsOptional()
  @IsUUID()
  followUpQuestionId?: string;
}
