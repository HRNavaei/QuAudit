import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateSupplierDto {
  @ApiPropertyOptional({
    description: "Updated name of the supplier company",
    example: "Acme Advanced Technologies Inc.",
  })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({
    description: "Updated description of company capabilities",
    example:
      "Global provider of advanced industrial IoT sensors and automation hardware",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: "Updated physical address",
    example: "456 Tech Boulevard, Suite 200, Austin, TX 78758",
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: "Updated contact telephone number",
    example: "+1-512-555-0288",
  })
  @IsString()
  @IsOptional()
  phone?: string;
}
