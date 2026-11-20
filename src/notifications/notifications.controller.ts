import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseBoolPipe,
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
import { CurrentUser, RequestUser } from "../auth/current-user.decorator";
import { NotificationsService } from "./notifications.service";
import { NotificationResponseDto } from "./dto/notification-response.dto";

@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: "Get notifications for current user",
    description:
      "Retrieves notifications received by the authenticated user, optionally filtered to unread only.",
  })
  @ApiQuery({
    name: "unreadOnly",
    required: false,
    type: Boolean,
    description: "If true, returns only unread notifications",
  })
  @ApiResponse({
    status: 200,
    description: "Notifications list",
    type: [NotificationResponseDto],
  })
  async getMyNotifications(
    @CurrentUser() user: RequestUser,
    @Query("unreadOnly", new ParseBoolPipe({ optional: true }))
    unreadOnly?: boolean,
  ) {
    return this.notificationsService.getMyNotifications(user.userId, unreadOnly);
  }

  @Patch(":id/read")
  @ApiOperation({
    summary: "Mark a notification as read",
    description: "Marks a specific notification belonging to the current user as read.",
  })
  @ApiParam({ name: "id", description: "Notification UUID" })
  @ApiResponse({
    status: 200,
    description: "Notification marked as read",
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 404, description: "Notification not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async markAsRead(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationsService.markAsRead(id, user.userId);
  }

  @Patch("read-all")
  @ApiOperation({
    summary: "Mark all notifications as read",
    description: "Marks all unread notifications for the current user as read.",
  })
  @ApiResponse({
    status: 200,
    description: "All notifications marked as read",
  })
  async markAllAsRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllAsRead(user.userId);
  }
}
