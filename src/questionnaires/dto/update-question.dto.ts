import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, Min } from "class-validator";
import { QuestionType } from "@prisma/client";

export class UpdateQuestionDto {
  @ApiPropertyOptional({ example: "Updated question text?" })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
