import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "@prisma/client";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return (
            req?.cookies?.Authentication ||
            req?.headers?.authorization?.split(" ")[1]
          );
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: any) {
    let isApproved = true;
    if (payload.role === Role.SUPPLIER) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { userId: payload.sub },
        select: { isApproved: true },
      });
      isApproved = supplier ? supplier.isApproved : false;
    }
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      isApproved,
    };
  }
}
