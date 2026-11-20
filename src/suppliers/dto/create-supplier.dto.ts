import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateSupplierDto {
  @ApiProperty({
    description: "Name of the supplier company",
    example: "Acme Industrial Solutions",
  })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiPropertyOptional({
    description: "Detailed description of company capabilities and services",
    example:
      "Leading manufacturer of high-precision sensors and electronic components",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: "Physical address of the supplier headquarters or facility",
    example: "123 Innovation Way, Tech Park, Austin, TX 78759",
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: "Primary contact telephone number",
    example: "+1-512-555-0199",
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description:
      "Target User UUID to bind to the supplier profile (ADMIN and SUPERVISOR only; ignored for SUPPLIER role)",
    example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    format: "uuid",
  })
  @IsUUID()
  @IsOptional()
  userId?: string;
}
