import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { MicrosoftStrategy } from "../strategies/microsoft.strategy";
import { AuthController } from "./auth.controller";
import { AuthService } from "../services/auth.service";

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [AuthService, MicrosoftStrategy],
})
export class AuthModule {}
