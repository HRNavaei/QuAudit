import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: "Updated name of the product",
    example: "Industrial Pressure Sensor X-200 Gen 2",
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: "Updated product specifications",
    example:
      "Enhanced high-precision pressure transmitter with MODBUS RTU support",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: "Updated product category",
    example: "Process Instrumentation",
  })
  @IsString()
  @IsOptional()
  category?: string;
}
