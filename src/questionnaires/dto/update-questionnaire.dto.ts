import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsEnum } from "class-validator";
import { QuestionnaireStatus } from "@prisma/client";

export class UpdateQuestionnaireDto {
  @ApiPropertyOptional({ example: "Updated Questionnaire Title" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: "Updated description text" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: QuestionnaireStatus })
  @IsOptional()
  @IsEnum(QuestionnaireStatus)
  status?: QuestionnaireStatus;
}
