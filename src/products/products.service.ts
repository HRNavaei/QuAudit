import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "@prisma/client";
import { RequestUser } from "../auth/current-user.decorator";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto, currentUser: RequestUser) {
    let targetSupplierId: string;

    if (currentUser.role === Role.SUPPLIER) {
      // Resolve supplier profile for the current authenticated user
      const supplier = await this.prisma.supplier.findUnique({
        where: { userId: currentUser.userId },
      });

      if (!supplier) {
        throw new ForbiddenException(
          "Supplier profile must be created before adding products",
        );
      }
      targetSupplierId = supplier.id;
    } else {
      // ADMIN or SUPERVISOR must provide a valid supplierId
      if (!dto.supplierId) {
        throw new BadRequestException(
          "supplierId is required for admin/supervisor creating a product",
        );
      }

      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Supplier with ID ${dto.supplierId} not found`,
        );
      }
      targetSupplierId = supplier.id;
    }

    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        supplierId: targetSupplierId,
      },
    });
  }

  async findAll(currentUser: RequestUser, supplierIdFilter?: string) {
    if (currentUser.role === Role.SUPPLIER) {
      // SUPPLIER can only see products belonging to their own supplier profile
      const supplier = await this.prisma.supplier.findUnique({
        where: { userId: currentUser.userId },
      });

      if (!supplier) {
        return [];
      }

      return this.prisma.product.findMany({
        where: { supplierId: supplier.id },
        orderBy: { createdAt: "desc" },
      });
    }

    // ADMIN and SUPERVISOR see all products, or filter by query param
    const whereClause = supplierIdFilter
      ? { supplierId: supplierIdFilter }
      : {};
    return this.prisma.product.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, currentUser: RequestUser) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // RBAC check: SUPPLIER can only view their own products
    if (currentUser.role === Role.SUPPLIER) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { userId: currentUser.userId },
      });

      if (!supplier || product.supplierId !== supplier.id) {
        throw new ForbiddenException(
          "You do not have permission to view this product",
        );
      }
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto, currentUser: RequestUser) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // RBAC check: SUPPLIER can only update their own products
    if (currentUser.role === Role.SUPPLIER) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { userId: currentUser.userId },
      });

      if (!supplier || product.supplierId !== supplier.id) {
        throw new ForbiddenException(
          "You do not have permission to update this product",
        );
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
      },
    });
  }

  async remove(id: string, currentUser: RequestUser) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // RBAC check: SUPPLIER can only delete their own products
    if (currentUser.role === Role.SUPPLIER) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { userId: currentUser.userId },
      });

      if (!supplier || product.supplierId !== supplier.id) {
        throw new ForbiddenException(
          "You do not have permission to delete this product",
        );
      }
    }

    await this.prisma.product.delete({
      where: { id },
    });

    return { message: "Product deleted successfully" };
  }
}
