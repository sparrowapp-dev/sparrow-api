import { Controller, Get, Param, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { FastifyReply } from "fastify";
import { HttpStatusCode } from "../common/enum/httpStatusCode.enum";

/**
 * App Controller
 */
@Controller()
export class AppController {
  constructor(private configService: ConfigService) {}

  @Get("updater/:target/:arch/:currentVersion")
  @ApiOperation({
    summary: "Updater Details",
    description: "Fetch app updater json",
  })
  @ApiResponse({
    status: 200,
    description: "Updater Details Retrieved Successfully",
  })
  @ApiResponse({ status: 204, description: "No Content" })
  async getUpdaterDetails(
    @Res() res: FastifyReply,
    @Param("target") target: string,
    @Param("arch") arch: string,
    @Param("currentVersion") currentVersion: string,
  ) {
    if (
      this.configService.get("updater.updateAvailable") === "true" &&
      currentVersion < this.configService.get("updater.appVersion")
    ) {
      const data = {
        version: this.configService.get("updater.appVersion"),
        platforms: {
          "windows-x86_64": {
            signature: this.configService.get("updater.windows.appSignature"),
            url: this.configService.get("updater.windows.appUrl"),
          },
          "darwin-aarch64": {
            signature: this.configService.get("updater.macM1.appSignature"),
            url: this.configService.get("updater.macM1.appUrl"),
          },
          "darwin-x86_64": {
            signature: this.configService.get("updater.macIntel.appSignature"),
            url: this.configService.get("updater.macIntel.appUrl"),
          },
        },
      };
      return res.status(HttpStatusCode.OK).send(data);
    }
    return res.status(HttpStatusCode.NO_CONTENT).send();
  }
}
