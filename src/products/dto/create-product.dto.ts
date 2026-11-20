import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateProductDto {
  @ApiProperty({
    description: "Name of the product",
    example: "Industrial Pressure Sensor X-200",
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: "Detailed product specifications and description",
    example:
      "High-precision piezoresistive pressure transmitter with IP67 rating",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: "Product category or classification",
    example: "Industrial Sensors",
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description:
      "Supplier UUID to link this product to. Required for ADMIN and SUPERVISOR; automatically resolved from current user profile for SUPPLIER role.",
    example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
    format: "uuid",
  })
  @IsUUID()
  @IsOptional()
  supplierId?: string;
}
