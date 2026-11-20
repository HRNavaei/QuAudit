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
import { QuestionnaireStatus, Role } from "@prisma/client";
import { QuestionnairesService } from "./questionnaires.service";
import { CreateQuestionnaireDto } from "./dto/create-questionnaire.dto";
import { UpdateQuestionnaireDto } from "./dto/update-questionnaire.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { CreateOptionDto } from "./dto/create-option.dto";
import { UpdateOptionDto } from "./dto/update-option.dto";
import {
  QuestionnaireResponseDto,
  QuestionResponseDto,
  QuestionOptionResponseDto,
} from "./dto/questionnaire-response.dto";

@ApiTags("Questionnaires")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("questionnaires")
export class QuestionnairesController {
  constructor(private readonly questionnairesService: QuestionnairesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Create a questionnaire",
    description: "Creates a new questionnaire in DRAFT status. Only ADMIN and SUPERVISOR.",
  })
  @ApiResponse({
    status: 201,
    description: "Questionnaire created successfully",
    type: QuestionnaireResponseDto,
  })
  async create(
    @Body() dto: CreateQuestionnaireDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.questionnairesService.createQuestionnaire(dto, user.userId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "List questionnaires",
    description:
      "Lists questionnaires. ADMIN/SUPERVISOR can view all questionnaires; SUPPLIER can only view published or assigned questionnaires.",
  })
  @ApiQuery({
    name: "status",
    enum: QuestionnaireStatus,
    required: false,
    description: "Filter by questionnaire status (DRAFT, PUBLISHED, ARCHIVED)",
  })
  @ApiResponse({
    status: 200,
    description: "List of questionnaires",
    type: [QuestionnaireResponseDto],
  })
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query("status") status?: QuestionnaireStatus,
  ) {
    return this.questionnairesService.findAll(user, status);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.SUPPLIER)
  @ApiOperation({
    summary: "Get questionnaire details",
    description: "Retrieves questionnaire details including questions and options.",
  })
  @ApiParam({ name: "id", description: "Questionnaire UUID" })
  @ApiResponse({
    status: 200,
    description: "Questionnaire details",
    type: QuestionnaireResponseDto,
  })
  @ApiResponse({ status: 404, description: "Questionnaire not found" })
  @ApiResponse({ status: 403, description: "Forbidden for supplier if unpublished" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.questionnairesService.findOne(id, user);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Update questionnaire",
    description: "Updates questionnaire metadata or status. Only ADMIN and SUPERVISOR.",
  })
  @ApiParam({ name: "id", description: "Questionnaire UUID" })
  @ApiResponse({
    status: 200,
    description: "Questionnaire updated successfully",
    type: QuestionnaireResponseDto,
  })
  @ApiResponse({ status: 404, description: "Questionnaire not found" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateQuestionnaireDto,
  ) {
    return this.questionnairesService.updateQuestionnaire(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Delete questionnaire",
    description: "Deletes a questionnaire. Only ADMIN and SUPERVISOR.",
  })
  @ApiParam({ name: "id", description: "Questionnaire UUID" })
  @ApiResponse({ status: 200, description: "Questionnaire deleted successfully" })
  @ApiResponse({ status: 404, description: "Questionnaire not found" })
  async remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.questionnairesService.deleteQuestionnaire(id);
  }

  @Post(":id/versions")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Create a new version of questionnaire",
    description:
      "Clones the questionnaire and its questions/options into a new DRAFT questionnaire with incremented version number and parentId set.",
  })
  @ApiParam({ name: "id", description: "Parent questionnaire UUID" })
  @ApiResponse({
    status: 201,
    description: "New questionnaire version created",
    type: QuestionnaireResponseDto,
  })
  @ApiResponse({ status: 404, description: "Parent questionnaire not found" })
  async createVersion(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.questionnairesService.createVersion(id, user.userId);
  }

  // --- Questions Endpoints ---

  @Post(":id/questions")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Add question to questionnaire",
    description: "Creates a question within the questionnaire.",
  })
  @ApiParam({ name: "id", description: "Questionnaire UUID" })
  @ApiResponse({
    status: 201,
    description: "Question created",
    type: QuestionResponseDto,
  })
  async addQuestion(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionnairesService.addQuestion(id, dto);
  }

  @Patch(":id/questions/:questionId")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Update question",
    description: "Updates question details.",
  })
  @ApiParam({ name: "id", description: "Questionnaire UUID" })
  @ApiParam({ name: "questionId", description: "Question UUID" })
  @ApiResponse({
    status: 200,
    description: "Question updated",
    type: QuestionResponseDto,
  })
  async updateQuestion(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("questionId", new ParseUUIDPipe()) questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionnairesService.updateQuestion(id, questionId, dto);
  }

  @Delete(":id/questions/:questionId")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Delete question",
    description: "Deletes a question and its associated options.",
  })
  @ApiParam({ name: "id", description: "Questionnaire UUID" })
  @ApiParam({ name: "questionId", description: "Question UUID" })
  @ApiResponse({ status: 200, description: "Question deleted" })
  async deleteQuestion(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("questionId", new ParseUUIDPipe()) questionId: string,
  ) {
    return this.questionnairesService.deleteQuestion(id, questionId);
  }

  // --- Question Options Endpoints ---

  @Post(":id/questions/:questionId/options")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Add option to question",
    description:
      "Adds an option to a single-choice question, optionally specifying a followUpQuestionId from the same questionnaire.",
  })
  @ApiParam({ name: "id", description: "Questionnaire UUID" })
  @ApiParam({ name: "questionId", description: "Question UUID" })
  @ApiResponse({
    status: 201,
    description: "Option created",
    type: QuestionOptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid follow-up question (e.g. from another questionnaire)",
  })
  async addOption(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("questionId", new ParseUUIDPipe()) questionId: string,
    @Body() dto: CreateOptionDto,
  ) {
    return this.questionnairesService.addOption(id, questionId, dto);
  }

  @Patch(":id/questions/:questionId/options/:optionId")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Update question option",
    description: "Updates option label, value, order, or follow-up question link.",
  })
  @ApiParam({ name: "id", description: "Questionnaire UUID" })
  @ApiParam({ name: "questionId", description: "Question UUID" })
  @ApiParam({ name: "optionId", description: "Option UUID" })
  @ApiResponse({
    status: 200,
    description: "Option updated",
    type: QuestionOptionResponseDto,
  })
  async updateOption(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("questionId", new ParseUUIDPipe()) questionId: string,
    @Param("optionId", new ParseUUIDPipe()) optionId: string,
    @Body() dto: UpdateOptionDto,
  ) {
    return this.questionnairesService.updateOption(id, questionId, optionId, dto);
  }

  @Delete(":id/questions/:questionId/options/:optionId")
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({
    summary: "Delete question option",
    description: "Deletes a question option.",
  })
  @ApiParam({ name: "id", description: "Questionnaire UUID" })
  @ApiParam({ name: "questionId", description: "Question UUID" })
  @ApiParam({ name: "optionId", description: "Option UUID" })
  @ApiResponse({ status: 200, description: "Option deleted" })
  async deleteOption(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("questionId", new ParseUUIDPipe()) questionId: string,
    @Param("optionId", new ParseUUIDPipe()) optionId: string,
  ) {
    return this.questionnairesService.deleteOption(id, questionId, optionId);
  }
}
