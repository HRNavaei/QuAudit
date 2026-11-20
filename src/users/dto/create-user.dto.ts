import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
} from "class-validator";
import { Role } from "@prisma/client";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
