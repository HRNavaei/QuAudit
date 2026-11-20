import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsEnum } from "class-validator";
import { AssignmentStatus } from "@prisma/client";

export class UpdateAssignmentStatusDto {
  @ApiProperty({
    enum: AssignmentStatus,
    example: AssignmentStatus.IN_PROGRESS,
    description: "New status of the assignment",
  })
  @IsNotEmpty()
  @IsEnum(AssignmentStatus)
  status!: AssignmentStatus;
}
