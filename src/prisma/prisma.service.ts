import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "info", "warn", "error"]
          : ["error"],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("cleanDatabase is not allowed in production");
    }
    const models = Reflect.ownKeys(this).filter(
      (key) =>
        typeof key === "string" && !key.startsWith("_") && !key.startsWith("$"),
    );

    return this.$transaction([
      this.$executeRaw`SET session_replication_role = 'replica'`,
      ...[
        "answers",
        "question_options",
        "questions",
        "questionnaire_assignments",
        "notifications",
        "products",
        "questionnaires",
        "suppliers",
        "users",
      ].map((table) =>
        this.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`),
      ),
      this.$executeRaw`SET session_replication_role = 'origin'`,
    ]);
  }
}
