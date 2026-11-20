import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, RequestUser } from "../auth/current-user.decorator";
import { Role } from "@prisma/client";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductResponseDto } from "./dto/product-response.dto";

@ApiTags("Products")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Create product",
    description:
      "Creates a new product. For SUPPLIER role users, product is auto-bound to their supplier profile. ADMIN and SUPERVISOR must provide a valid supplierId.",
  })
  @ApiResponse({
    status: 201,
    description: "Product created successfully",
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Validation error in request payload or missing supplierId for admin",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - Supplier profile must be created before adding products",
  })
  @ApiResponse({
    status: 404,
    description: "Supplier not found (when specified by admin)",
  })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "List products",
    description:
      "Retrieves products. ADMIN and SUPERVISOR see all products or filter by supplierId. SUPPLIER role users only see products belonging to their own supplier profile.",
  })
  @ApiQuery({
    name: "supplierId",
    required: false,
    description: "Filter products by supplier UUID (ADMIN and SUPERVISOR only)",
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "List of accessible products",
    type: [ProductResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: "Validation error - invalid supplierId UUID format",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query("supplierId", new ParseUUIDPipe({ optional: true }))
    supplierId?: string,
  ) {
    return this.productsService.findAll(user, supplierId);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Get product by ID",
    description:
      "Retrieves details of a specific product. ADMIN and SUPERVISOR can view any product. SUPPLIER role users can only view their own products.",
  })
  @ApiParam({
    name: "id",
    description: "Product UUID",
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Product details",
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - SUPPLIER cannot view products of other suppliers",
  })
  @ApiResponse({
    status: 404,
    description: "Product not found",
  })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.findOne(id, user);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Update product",
    description:
      "Updates product details. SUPPLIER role users can only update their own products. ADMIN and SUPERVISOR can update any product.",
  })
  @ApiParam({
    name: "id",
    description: "Product UUID",
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Product updated successfully",
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation error in request payload",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - SUPPLIER cannot update products of other suppliers",
  })
  @ApiResponse({
    status: 404,
    description: "Product not found",
  })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Delete product",
    description:
      "Deletes a product. SUPPLIER role users can only delete their own products. ADMIN and SUPERVISOR can delete any product.",
  })
  @ApiParam({
    name: "id",
    description: "Product UUID",
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Product deleted successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - SUPPLIER cannot delete products of other suppliers",
  })
  @ApiResponse({
    status: 404,
    description: "Product not found",
  })
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.remove(id, user);
  }
}
