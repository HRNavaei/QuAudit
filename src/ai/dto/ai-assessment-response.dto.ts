import { ApiProperty } from "@nestjs/swagger";

export class AiAssessmentResponseDto {
  @ApiProperty({
    example: 82,
    description: "Indicative compliance/quality score from 0 to 100 based strictly on submitted answers",
  })
  score!: number;

  @ApiProperty({
    example: "Good",
    description: "Indicative rating label (e.g. Excellent, Good, Satisfactory, Needs Improvement)",
  })
  label!: string;

  @ApiProperty({
    example: "The supplier demonstrates generally good compliance with documented quality procedures.",
    description: "Concise evaluation summary of the supplier's questionnaire responses",
  })
  summary!: string;

  @ApiProperty({
    type: [String],
    example: ["Quality-control procedures are insufficiently documented."],
    description: "Up to three notable weaknesses, risks, or concerning answers",
  })
  concerns!: string[];

  @ApiProperty({
    type: [String],
    example: ["Establish and publish documented quality-control standard operating procedures."],
    description: "Up to three practical, constructive recommendations for improvement",
  })
  recommendations!: string[];

  @ApiProperty({
    example: "This is an AI-generated assessment and should not be treated as a verified compliance rating.",
    description: "Standard disclaimer reminding reviewers that this assessment is automated and indicative",
  })
  disclaimer!: string;
}
