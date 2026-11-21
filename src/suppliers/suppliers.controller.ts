import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser, RequestUser } from "../auth/current-user.decorator";
import { Role } from "@prisma/client";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SupplierResponseDto } from "./dto/supplier-response.dto";

@ApiTags("Suppliers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Create supplier profile (Deprecated)",
    description:
      "Manual supplier profile creation is disabled. Suppliers must self-register via POST /api/auth/register.",
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - Manual creation is disabled. Suppliers must self-register.",
  })
  async create(
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suppliersService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "List all suppliers",
    description:
      "Retrieves all supplier profiles in the system. Restricted to ADMIN and SUPERVISOR roles.",
  })
  @ApiResponse({
    status: 200,
    description: "List of all supplier profiles",
    type: [SupplierResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - SUPPLIER role users cannot access the global supplier list",
  })
  async findAll() {
    return this.suppliersService.findAll();
  }

  @Get("pending")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "List pending supplier registrations",
    description:
      "Retrieves all supplier profiles awaiting supervisor approval. Accessible to SUPERVISOR and ADMIN roles.",
  })
  @ApiResponse({
    status: 200,
    description: "List of pending supplier registrations",
    type: [SupplierResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - Only SUPERVISOR and ADMIN roles can retrieve pending supplier registrations",
  })
  async findPending() {
    return this.suppliersService.getPendingSuppliers();
  }

  // NOTE: 'me' route MUST precede ':id' to prevent route matching collisions
  @Get("me")
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Get current user supplier profile",
    description:
      "Retrieves the supplier profile bound to the currently authenticated user.",
  })
  @ApiResponse({
    status: 200,
    description: "Supplier profile of current user",
    type: SupplierResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 404,
    description:
      "Not found - current user does not have an associated supplier profile",
  })
  async getMyProfile(@CurrentUser() user: RequestUser) {
    return this.suppliersService.findMyProfile(user);
  }

  @Patch(":id/approve")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Approve pending supplier registration",
    description:
      "Approves a pending supplier account. Once approved, the supplier can access supplier functionality. Accessible to SUPERVISOR and ADMIN roles.",
  })
  @ApiParam({
    name: "id",
    description: "Supplier UUID to approve",
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Supplier approved successfully",
    type: SupplierResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Supplier is already approved",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - Only SUPERVISOR role can approve supplier registrations",
  })
  @ApiResponse({
    status: 404,
    description: "Supplier not found",
  })
  async approve(@Param("id", ParseUUIDPipe) id: string) {
    return this.suppliersService.approveSupplier(id);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Get supplier profile by ID",
    description:
      "Retrieves a specific supplier profile. ADMIN and SUPERVISOR can access any supplier; SUPPLIER users may only access their own profile.",
  })
  @ApiParam({
    name: "id",
    description: "Supplier UUID",
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Supplier profile details",
    type: SupplierResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - SUPPLIER cannot view other suppliers profiles",
  })
  @ApiResponse({
    status: 404,
    description: "Supplier not found",
  })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suppliersService.findOne(id, user);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Update supplier profile",
    description:
      "Updates supplier profile information. SUPPLIER role users can only update their own profile. ADMIN and SUPERVISOR can update any profile.",
  })
  @ApiParam({
    name: "id",
    description: "Supplier UUID",
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Supplier profile updated successfully",
    type: SupplierResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation error in update payload",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - SUPPLIER cannot update other suppliers profiles",
  })
  @ApiResponse({
    status: 404,
    description: "Supplier not found",
  })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suppliersService.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Delete supplier profile",
    description:
      "Deletes a supplier profile and cascades to associated products. Restricted to ADMIN and SUPERVISOR roles.",
  })
  @ApiParam({
    name: "id",
    description: "Supplier UUID",
    format: "uuid",
  })
  @ApiResponse({
    status: 200,
    description: "Supplier profile deleted successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - SUPPLIER role users cannot delete supplier profiles",
  })
  @ApiResponse({
    status: 404,
    description: "Supplier not found",
  })
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.suppliersService.remove(id, user);
  }
}
