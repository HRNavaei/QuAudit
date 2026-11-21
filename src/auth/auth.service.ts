import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import * as argon2 from "argon2";
import { Role, User } from "@prisma/client";
import { RegisterDto } from "./dto/register.dto";

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

  async register(data: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    const hashed = await argon2.hash(data.password);
    const companyName =
      data.companyName || `${data.firstName} ${data.lastName}`;

    const { user, supplier } = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          password: hashed,
          firstName: data.firstName,
          lastName: data.lastName,
          role: Role.SUPPLIER,
        },
      });

      const newSupplier = await tx.supplier.create({
        data: {
          companyName,
          description: data.description || null,
          phone: data.phone || null,
          address: data.address || null,
          userId: newUser.id,
          isApproved: false,
        },
      });

      return { user: newUser, supplier: newSupplier };
    });

    const loginRes = await this.login(user);
    return {
      message:
        "Supplier registered successfully. Account is pending supervisor approval.",
      access_token: loginRes.access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      supplier: {
        id: supplier.id,
        companyName: supplier.companyName,
        description: supplier.description,
        phone: supplier.phone,
        address: supplier.address,
        isApproved: supplier.isApproved,
      },
    };
  }
}
