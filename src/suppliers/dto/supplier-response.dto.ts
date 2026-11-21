import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SupplierUserSummaryDto {
  @ApiProperty({
    example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    format: "uuid",
  })
  id!: string;

  @ApiProperty({ example: "supplier@example.com" })
  email!: string;

  @ApiProperty({ example: "John" })
  firstName!: string;

  @ApiProperty({ example: "Doe" })
  lastName!: string;

  @ApiProperty({ example: "SUPPLIER" })
  role!: string;
}

export class SupplierResponseDto {
  @ApiProperty({
    description: "Unique supplier UUID",
    example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
    format: "uuid",
  })
  id!: string;

  @ApiProperty({
    description: "Company name",
    example: "Acme Industrial Solutions",
  })
  companyName!: string;

  @ApiPropertyOptional({
    description: "Company description",
    example: "Leading manufacturer of industrial equipment",
    nullable: true,
  })
  description?: string | null;

  @ApiPropertyOptional({
    description: "Physical address",
    example: "123 Innovation Way, Tech Park, Austin, TX 78759",
    nullable: true,
  })
  address?: string | null;

  @ApiPropertyOptional({
    description: "Contact phone number",
    example: "+1-512-555-0199",
    nullable: true,
  })
  phone?: string | null;

  @ApiProperty({
    description: "Approval status of supplier registration by supervisor",
    example: true,
  })
  isApproved!: boolean;

  @ApiProperty({
    description: "UUID of the linked User account (1:0..1 cardinality)",
    example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    format: "uuid",
  })
  userId!: string;

  @ApiProperty({
    description: "Record creation timestamp",
    example: "2026-11-19T10:00:00.000Z",
  })
  createdAt!: Date;

  @ApiProperty({
    description: "Record last update timestamp",
    example: "2026-11-19T10:00:00.000Z",
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: "Associated user account profile (sanitized, no password)",
    type: () => SupplierUserSummaryDto,
  })
  user?: SupplierUserSummaryDto;
}
