import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ProductResponseDto {
  @ApiProperty({
    description: "Unique product UUID",
    example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
    format: "uuid",
  })
  id!: string;

  @ApiProperty({
    description: "Product name",
    example: "Industrial Pressure Sensor X-200",
  })
  name!: string;

  @ApiPropertyOptional({
    description: "Product description",
    example: "High-precision piezoresistive pressure transmitter",
    nullable: true,
  })
  description?: string | null;

  @ApiPropertyOptional({
    description: "Product category",
    example: "Industrial Sensors",
    nullable: true,
  })
  category?: string | null;

  @ApiProperty({
    description: "UUID of the owning Supplier",
    example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
    format: "uuid",
  })
  supplierId!: string;

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
}
