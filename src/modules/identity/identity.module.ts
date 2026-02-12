import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { UserService } from "./services/user.service";
import { UserRepository } from "./repositories/user.repository";
import { UserController } from "./controllers/user.controller";
import { TeamService } from "./services/team.service";
import { PlanService } from "./services/plan.service";
import { PlanRepository } from "./repositories/plan.repository";
import { TeamUserService } from "./services/team-user.service";
import { TeamRepository } from "./repositories/team.repository";
import { UserInvitesRepository } from "./repositories/userInvites.repository";
import { TeamController } from "./controllers/team.controller";
import { PlanController } from "./controllers/plan.controller";
import { RefreshTokenStrategy } from "./strategies/refresh-token.strategy";
import { HubSpotService } from "./services/hubspot.service";
import { GoogleStrategy } from "./strategies/google.strategy";
import { BillingModule } from "../billing/billing.module";
import { BillingAuditService } from "../billing/services/billing-audit.service";
import { StripeSubscriptionService } from "../billing/services/stripe-subscription.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { forwardRef } from "@nestjs/common";

@Module({
  imports: [
    ConfigModule,
    BillingModule.register(),
    forwardRef(() => NotificationsModule),
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return {
          secret: configService.get("app.jwtSecretKey"),
          signOptions: {
            ...(configService.get("app.jwtExpirationTime")
              ? {
                  expiresIn: Number(configService.get("app.jwtExpirationTime")),
                }
              : {}),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    RefreshTokenStrategy,
    UserService,
    JwtService,
    UserRepository,
    TeamService,
    PlanService,
    TeamUserService,
    TeamRepository,
    PlanRepository,
    BillingAuditService,
    StripeSubscriptionService,
    {
      provide: GoogleStrategy,
      useFactory: (configService: ConfigService) => {
        const isGoogleAuthEnabled = configService.get(
          "oauth.google.enableGoogleAuth",
          "true",
        );
        return isGoogleAuthEnabled === "true"
          ? new GoogleStrategy(configService)
          : null;
      },
      inject: [ConfigService],
    },
    HubSpotService,
    UserInvitesRepository,
  ],
  exports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    AuthService,
    UserService,
    UserRepository,
    TeamService,
    PlanService,
    TeamUserService,
    TeamRepository,
    PlanRepository,
    UserInvitesRepository,
    HubSpotService,
    StripeSubscriptionService,
  ],
  controllers: [AuthController, UserController, TeamController, PlanController],
})
export class IdentityModule {}
