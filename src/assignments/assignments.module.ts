import { Module } from "@nestjs/common";
import { AssignmentsController } from "./assignments.controller";
import { AssignmentsService } from "./assignments.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [NotificationsModule, AiModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
