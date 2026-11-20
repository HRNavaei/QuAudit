import { ApiProperty } from "@nestjs/swagger";

export class NotificationResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  id!: string;

  @ApiProperty({ example: "New Questionnaire Assigned" })
  title!: string;

  @ApiProperty({
    example: "You have been assigned the Quality Audit 2026 questionnaire.",
  })
  message!: string;

  @ApiProperty({ example: "ASSIGNMENT" })
  type!: string;

  @ApiProperty({ example: false })
  isRead!: boolean;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440001" })
  senderId!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440002" })
  receiverId!: string;

  @ApiProperty({ example: "2026-11-19T12:00:00.000Z" })
  createdAt!: Date;
}
