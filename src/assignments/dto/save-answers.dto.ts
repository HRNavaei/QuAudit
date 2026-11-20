import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class AnswerItemDto {
  @ApiProperty({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "Question UUID",
  })
  @IsNotEmpty()
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({ example: "Our company holds ISO 9001 certified in 2020." })
  @IsOptional()
  @IsString()
  textValue?: string;

  @ApiPropertyOptional({ example: 42.5 })
  @IsOptional()
  @IsNumber()
  numberValue?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  booleanValue?: boolean;

  @ApiPropertyOptional({
    example: "550e8400-e29b-41d4-a716-446655440001",
    description: "Selected QuestionOption UUID (for SINGLE_CHOICE / YES_NO)",
  })
  @IsOptional()
  @IsUUID()
  selectedOptionId?: string;
}

export class SaveAnswersDto {
  @ApiProperty({
    type: [AnswerItemDto],
    description: "Array of answers to record for the questionnaire assignment",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers!: AnswerItemDto[];
}
