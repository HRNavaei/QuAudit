import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { ProductsModule } from "./products/products.module";
import { QuestionnairesModule } from "./questionnaires/questionnaires.module";
import { AssignmentsModule } from "./assignments/assignments.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AiModule } from "./ai/ai.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SuppliersModule,
    ProductsModule,
    QuestionnairesModule,
    AssignmentsModule,
    NotificationsModule,
    AiModule,
  ],
})
export class AppModule {}
