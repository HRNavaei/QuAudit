import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({
    summary: "Register supplier account",
    description:
      "Public endpoint allowing a supplier to self-register their account and company profile. Automatically links User and Supplier records with pending approval status.",
  })
  @ApiResponse({
    status: 201,
    description: "Supplier registered successfully with pending approval status",
  })
  @ApiResponse({
    status: 400,
    description: "Validation error in registration data",
  })
  @ApiResponse({
    status: 409,
    description: "Email address already registered",
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("login")
  @ApiOperation({
    summary: "User login",
    description:
      "Authenticates a user by email and password and returns a JWT access token.",
  })
  @ApiResponse({
    status: 200,
    description: "Authentication successful, returns JWT access token",
  })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials",
  })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.authService.login(user);
  }
}
