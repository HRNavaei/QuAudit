import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role, User } from "@prisma/client";
import * as argon2 from "argon2";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Omit<User, "password">> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const { password, ...result } = user;
    return result;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: Role;
  }): Promise<Omit<User, "password">> {
    const hashedPassword = await argon2.hash(data.password);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || Role.SUPPLIER,
      },
    });
    const { password, ...result } = user;
    return result;
  }
}
