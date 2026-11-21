import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
    throw new ForbiddenException(
      "Manual supplier creation is disabled. Suppliers must self-register via /api/auth/register.",
    );
  }

  async getPendingSuppliers() {
    return this.prisma.supplier.findMany({
      where: { isApproved: false },
      include: {
        user: { select: USER_SELECT_FIELDS },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async approveSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        user: { select: USER_SELECT_FIELDS },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    if (supplier.isApproved) {
      throw new BadRequestException("Supplier is already approved");
    }

    return this.prisma.supplier.update({
      where: { id },
      data: { isApproved: true },
      include: {
        user: { select: USER_SELECT_FIELDS },
      },
    });
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
