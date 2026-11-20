import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsEnum, IsBoolean, IsInt, IsOptional, Min } from "class-validator";
import { QuestionType } from "@prisma/client";

export class CreateQuestionDto {
  @ApiProperty({ example: "Does your company have ISO 9001 certification?" })
  @IsNotEmpty()
  @IsString()
  text!: string;

  @ApiProperty({ enum: QuestionType, example: QuestionType.YES_NO })
  @IsNotEmpty()
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
