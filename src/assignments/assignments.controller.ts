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
import { AssignmentStatus, Role } from "@prisma/client";
import { AssignmentsService } from "./assignments.service";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { UpdateAssignmentStatusDto } from "./dto/update-assignment-status.dto";
import { SaveAnswersDto } from "./dto/save-answers.dto";
import {
  AssignmentResponseDto,
  AnswerResponseDto,
} from "./dto/assignment-response.dto";

@ApiTags("Assignments & Responses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("assignments")
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Assign questionnaire to supplier",
    description:
      "Assigns a questionnaire to a supplier, optionally targeting a specific product belonging to that supplier. Triggers in-app notification. Only ADMIN and SUPERVISOR.",
  })
  @ApiResponse({
    status: 201,
    description: "Assignment created successfully",
    type: AssignmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Product does not belong to supplier",
  })
  @ApiResponse({
    status: 409,
    description: "Duplicate assignment already exists",
  })
  async create(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assignmentsService.createAssignment(dto, user.userId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "List questionnaire assignments",
    description:
      "Lists assignments. SUPPLIER users only see their own assignments; ADMIN and SUPERVISOR can filter across all suppliers, products, and questionnaires.",
  })
  @ApiQuery({ name: "supplierId", required: false, type: String })
  @ApiQuery({ name: "productId", required: false, type: String })
  @ApiQuery({ name: "questionnaireId", required: false, type: String })
  @ApiQuery({ name: "status", enum: AssignmentStatus, required: false })
  @ApiResponse({
    status: 200,
    description: "List of assignments",
    type: [AssignmentResponseDto],
  })
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query("supplierId", new ParseUUIDPipe({ optional: true }))
    supplierId?: string,
    @Query("productId", new ParseUUIDPipe({ optional: true }))
    productId?: string,
    @Query("questionnaireId", new ParseUUIDPipe({ optional: true }))
    questionnaireId?: string,
    @Query("status") status?: AssignmentStatus,
  ) {
    return this.assignmentsService.findAll(user, {
      supplierId,
      productId,
      questionnaireId,
      status,
    });
  }

  @Get("questionnaire/:questionnaireId/responses")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Inspect submitted responses for a questionnaire",
    description:
      "Essential response retrieval for supervisors and admins to review all submitted answers, suppliers, and product information for a given questionnaire (Option B).",
  })
  @ApiParam({ name: "questionnaireId", description: "Questionnaire UUID" })
  @ApiResponse({
    status: 200,
    description: "List of submitted responses and structured answer data",
  })
  async getResponses(
    @Param("questionnaireId", new ParseUUIDPipe()) questionnaireId: string,
  ) {
    return this.assignmentsService.getResponsesByQuestionnaire(questionnaireId);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Get assignment details",
    description:
      "Retrieves assignment details, including full questionnaire questions, options, and any recorded answers.",
  })
  @ApiParam({ name: "id", description: "Assignment UUID" })
  @ApiResponse({
    status: 200,
    description: "Assignment details with answers",
    type: AssignmentResponseDto,
  })
  @ApiResponse({ status: 404, description: "Assignment not found" })
  @ApiResponse({ status: 403, description: "Forbidden for another supplier" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assignmentsService.findOne(id, user);
  }

  @Patch(":id/status")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Update assignment status",
    description: "Manually updates the assignment status. Only ADMIN and SUPERVISOR.",
  })
  @ApiParam({ name: "id", description: "Assignment UUID" })
  @ApiResponse({
    status: 200,
    description: "Assignment status updated",
    type: AssignmentResponseDto,
  })
  async updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAssignmentStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assignmentsService.updateStatus(id, dto, user);
  }

  @Post(":id/answers")
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Save answers for an assignment",
    description:
      "Saves or updates answers for the questionnaire assignment. Automatically sets status to IN_PROGRESS. Rejects if the assignment is already SUBMITTED.",
  })
  @ApiParam({ name: "id", description: "Assignment UUID" })
  @ApiResponse({
    status: 200,
    description: "Answers saved successfully",
    type: [AnswerResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: "Assignment is locked or question does not belong to questionnaire",
  })
  async saveAnswers(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: SaveAnswersDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assignmentsService.saveAnswers(id, dto, user);
  }

  @Post(":id/submit")
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Submit questionnaire responses",
    description:
      "Finalizes and submits the questionnaire assignment, locking the answers from further modifications. Notifies the questionnaire creator.",
  })
  @ApiParam({ name: "id", description: "Assignment UUID" })
  @ApiResponse({
    status: 200,
    description: "Assignment submitted and locked successfully",
    type: AssignmentResponseDto,
  })
  @ApiResponse({ status: 400, description: "Already submitted or missing required answers" })
  async submit(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assignmentsService.submitAssignment(id, user);
  }

  @Post(":id/reopen")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Re-open submitted assignment",
    description:
      "Re-opens a submitted assignment back to IN_PROGRESS status, unlocking answers for resubmission. Only ADMIN and SUPERVISOR.",
  })
  @ApiParam({ name: "id", description: "Assignment UUID" })
  @ApiResponse({
    status: 200,
    description: "Assignment re-opened successfully",
    type: AssignmentResponseDto,
  })
  async reopen(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.assignmentsService.reopenAssignment(id);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Delete assignment",
    description: "Deletes a questionnaire assignment. Only ADMIN and SUPERVISOR.",
  })
  @ApiParam({ name: "id", description: "Assignment UUID" })
  @ApiResponse({ status: 200, description: "Assignment deleted successfully" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.assignmentsService.deleteAssignment(id);
  }
}
