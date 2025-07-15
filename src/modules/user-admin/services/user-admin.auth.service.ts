import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ObjectId } from "mongodb";
import { UnauthorizedException } from "@nestjs/common";
import { AdminAuthRepository } from "../repositories/user-admin.auth.repository";
import { createHmac } from "crypto";
import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { AdminWorkspaceRepository } from "../repositories/user-admin.workspace.repository";

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly adminAuthRepository: AdminAuthRepository,
    private readonly configService: ConfigService,
    private readonly adminHubsRepository: AdminHubsRepository,
    private readonly adminWorkspaceRepository: AdminWorkspaceRepository,
  ) {}

  // Create access token
  async createToken(insertedId: ObjectId): Promise<any> {
    const user = await await this.adminAuthRepository.findUserById(insertedId);
    const expiryTime = this.configService.get("app.jwtExpirationTime");

    return {
      expires: expiryTime.toString(),
      token: this.jwtService.sign(
        {
          _id: insertedId,
          email: user.email,
          name: user.name,
          role: "admin",
        },
        {
          secret: this.configService.get("app.jwtSecretKey"),
          expiresIn: expiryTime,
        },
      ),
    };
  }

  // Create refresh token
  async createRefreshToken(insertedId: ObjectId): Promise<any> {
    const user = await await this.adminAuthRepository.findUserById(insertedId);
    const expiryTime = this.configService.get("app.refreshTokenExpirationTime");

    return {
      expires: expiryTime.toString(),
      token: this.jwtService.sign(
        {
          _id: insertedId,
          email: user.email,
          name: user.name,
          role: "admin",
        },
        {
          secret: this.configService.get("app.refreshTokenSecretKey"),
          expiresIn: expiryTime,
        },
      ),
    };
  }

  async validateShortLivedToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get("app.jwtSecretKey"),
      });

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        throw new UnauthorizedException("Token has expired");
      }

      const userId = new ObjectId(decoded._id);
      // generate new tokens if valid user
      const newAccessToken = await this.createToken(userId);
      const newRefreshToken = await this.createRefreshToken(userId);

      // store refresh token in db
      await this.adminAuthRepository.addRefreshTokenInUser(
        userId,
        createHmac("sha256", newRefreshToken.token).digest("hex"),
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      // Verify refresh token
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get("app.refreshTokenSecretKey"),
      });

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        throw new UnauthorizedException("Refresh token has expired");
      }

      const userId = new ObjectId(decoded._id);

      // Verify the refresh token exists in the user's record
      const hashedRefreshToken = createHmac("sha256", refreshToken).digest(
        "hex",
      );
      const isValidToken = await this.adminAuthRepository.verifyRefreshToken(
        userId,
        hashedRefreshToken,
      );

      if (!isValidToken) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      // Generate new tokens
      const newAccessToken = await this.createToken(userId);
      const newRefreshToken = await this.createRefreshToken(userId);

      // Update the refresh token in the database
      await this.adminAuthRepository.updateRefreshToken(
        userId,
        hashedRefreshToken,
        createHmac("sha256", newRefreshToken.token).digest("hex"),
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
  async getUserRole(userId: string, teamId: string, workspaceId: string) {
    if (teamId) {
      const team = await this.adminHubsRepository.findHubById(teamId);
      const userTeamRole = team.users.find(
        (user: any) => user.id.toString() === userId.toString(),
      ).role;
      return userTeamRole;
    }

    if (workspaceId) {
      const workspace =
        await this.adminWorkspaceRepository.findWorkspaceById(workspaceId);
      const userRole = workspace.users.find(
        (user: any) => user.id.toString() === userId.toString(),
      )?.role;
      return userRole;
    }
  }
}
