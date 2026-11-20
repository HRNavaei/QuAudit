import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role, Prisma } from "@prisma/client";
import { RequestUser } from "../auth/current-user.decorator";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

const USER_SELECT_FIELDS = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
};

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierDto, currentUser: RequestUser) {
    const targetUserId =
      currentUser.role === Role.SUPPLIER
        ? currentUser.userId
        : dto.userId || currentUser.userId;

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    // Check 1:0..1 cardinality: ensure user does not already have a supplier profile
    const existing = await this.prisma.supplier.findUnique({
      where: { userId: targetUserId },
    });
    if (existing) {
      throw new ConflictException(
        "Supplier profile already exists for this user",
      );
    }

    try {
      return await this.prisma.supplier.create({
        data: {
          companyName: dto.companyName,
          description: dto.description,
          address: dto.address,
          phone: dto.phone,
          userId: targetUserId,
        },
        include: {
          user: { select: USER_SELECT_FIELDS },
        },
      });
    } catch (error: any) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002") ||
        error?.code === "P2002"
      ) {
        throw new ConflictException(
          "Supplier profile already exists for this user",
        );
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.supplier.findMany({
      include: {
        user: { select: USER_SELECT_FIELDS },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findMyProfile(currentUser: RequestUser) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { userId: currentUser.userId },
      include: {
        user: { select: USER_SELECT_FIELDS },
        products: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException(
        "Supplier profile not found for current user",
      );
    }

    return supplier;
  }

  async findOne(id: string, currentUser: RequestUser) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        user: { select: USER_SELECT_FIELDS },
        products: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    // RBAC isolation: SUPPLIER can only view their own profile
    if (
      currentUser.role === Role.SUPPLIER &&
      supplier.userId !== currentUser.userId
    ) {
      throw new ForbiddenException(
        "You do not have permission to view this supplier profile",
      );
    }

    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto, currentUser: RequestUser) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    // RBAC isolation: SUPPLIER can only update their own profile
    if (
      currentUser.role === Role.SUPPLIER &&
      supplier.userId !== currentUser.userId
    ) {
      throw new ForbiddenException(
        "You do not have permission to update this supplier profile",
      );
    }

    return this.prisma.supplier.update({
      where: { id },
      data: {
        companyName: dto.companyName,
        description: dto.description,
        address: dto.address,
        phone: dto.phone,
      },
      include: {
        user: { select: USER_SELECT_FIELDS },
      },
    });
  }

  async remove(id: string, currentUser: RequestUser) {
    if (currentUser.role === Role.SUPPLIER) {
      throw new ForbiddenException(
        "Suppliers are not permitted to delete supplier profiles",
      );
    }

    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    await this.prisma.supplier.delete({
      where: { id },
    });

    return { message: "Supplier deleted successfully" };
  }
}
