import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsInt, IsUUID, Min } from "class-validator";

export class UpdateOptionDto {
  @ApiPropertyOptional({ example: "Certified Yes" })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: "YES" })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "Follow-up question ID or null to unlink",
  })
  @IsOptional()
  @IsUUID()
  followUpQuestionId?: string | null;
}
