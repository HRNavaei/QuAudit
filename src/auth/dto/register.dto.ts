import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class RegisterDto {
  @ApiProperty({
    example: "supplier@acme.com",
    description: "Account email address",
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: "SecurePassword123!",
    description: "Account password",
  })
  @IsNotEmpty()
  @IsString()
  password!: string;

  @ApiProperty({
    example: "John",
    description: "User first name",
  })
  @IsNotEmpty()
  @IsString()
  firstName!: string;

  @ApiProperty({
    example: "Doe",
    description: "User last name",
  })
  @IsNotEmpty()
  @IsString()
  lastName!: string;

  @ApiProperty({
    example: "Acme Industrial Supplies",
    description: "Supplier company name",
  })
  @IsNotEmpty()
  @IsString()
  companyName!: string;

  @ApiPropertyOptional({
    example: "Global distributor of high-precision sensors and lab supplies",
    description: "Supplier company description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: "+1-555-0199",
    description: "Contact phone number",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: "123 Technology Park, Suite 400, Austin, TX",
    description: "Physical business address",
  })
  @IsOptional()
  @IsString()
  address?: string;
}
