import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import * as argon2 from "argon2";
import { Role, User } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const passwordValid = await argon2.verify(user.password, pass);
    return passwordValid ? user : null;
  }

  async login(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: Role;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    const hashed = await argon2.hash(data.password);
    // Security enforcement: Public registration is strictly restricted to SUPPLIER role.
    // ADMIN and SUPERVISOR roles cannot be registered through public registration endpoints.
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashed,
        firstName: data.firstName,
        lastName: data.lastName,
        role: Role.SUPPLIER,
      },
    });
    return this.login(user);
  }
}
