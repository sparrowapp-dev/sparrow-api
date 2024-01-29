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
      // const data = {
      //   version: this.configService.get("updater.appVersion"),
      //   platforms: {
      //     "windows-x86_64": {
      //       signature: this.configService.get("updater.windows.appSignature"),
      //       url: this.configService.get("updater.windows.appUrl"),
      //     },
      //     "darwin-aarch64": {
      //       signature: this.configService.get("updater.macM1.appSignature"),
      //       url: this.configService.get("updater.macM1.appUrl"),
      //     },
      //     "darwin-x86_64": {
      //       signature: this.configService.get("updater.macIntel.appSignature"),
      //       url: this.configService.get("updater.macIntel.appUrl"),
      //     },
      //   },
      // };
      const data = {
        version: "0.1.1",
        notes: "See the assets to download this version and install.",
        pub_date: "2023-06-13T05:12:10.282Z",
        platforms: {
          "windows-x86_64": {
            signature:
              "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRWDRzdDZJNWdOdGtNSXJUa1VYUVZiT1BHdExQS2JDRFRuWnQyWWhVZzlTVkNvK0lYY3lscVdJSTd3blMyMUQ3VGIxM0FISXAycDdkYWRQRjNWbURCcDJ0Mk1NWlJybkFjPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzA1MDQ0MDc2CWZpbGU6c3BhcnJvdy1hcHBfMC4wLjBfeDY0LXNldHVwLm5zaXMuemlwCnJMVzN1VUNaM256amlEdzdXdUhjMEFXdk8xd28veEtqYWNFUDJIV2wvM091Z0RTU1ZKK2dCMTk4S3ZNcXlzWDNabmhuVVdNbG42ckF2elRQbVZXckNBPT0K",
            url: "https://appcenter-filemanagement-distrib3ede6f06e.azureedge.net/48c9ca97-5188-47e6-817f-35567accbd5b/Sparrow-app_0.0.0_x64_en-US.msi?sv=2019-02-02&sr=c&sig=9AjibRrKYjTcXXc8n0ZEWsgNTDZ2DKMJX4GUsLvSaYc%3D&se=2024-01-12T08%3A32%3A40Z&sp=r",
          },
          "darwin-aarch64": {
            signature:
              "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRSE1HWmJrS1Q4SzFzdFEwSjFhb0trQ29jZ3F3akZTMWlCMUF2enRBajRqZFo5SWFWNnV4R0o2UTFWR2dJV2RJK1lhTkFLV0ZHekJKWThESk4vTWxrSTRFb3l0VDRQc1FjPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzA1MTc3MzA0CWZpbGU6c3BhcnJvdy1hcHAuYXBwLnRhci5negpMM2V0TnllTXlFWjBtVFBsZVc0SnI0MDZPdmpwbzFxd0JFOHVCMXozTm44ZE5zTmlNOENsbzlQSk1RLytLenRzRFdoQXR0LzhlR1I2d0tlQTlYS09DZz09Cg==",
            url: "https://github.com/LordNayan/FindServer/blob/main/src/sparrow-app.app.tar.gz",
          },
          "darwin-x86_64": {
            signature:
              "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRSE1HWmJrS1Q4SzFzdFEwSjFhb0trQ29jZ3F3akZTMWlCMUF2enRBajRqZFo5SWFWNnV4R0o2UTFWR2dJV2RJK1lhTkFLV0ZHekJKWThESk4vTWxrSTRFb3l0VDRQc1FjPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzA1MTc3MzA0CWZpbGU6c3BhcnJvdy1hcHAuYXBwLnRhci5negpMM2V0TnllTXlFWjBtVFBsZVc0SnI0MDZPdmpwbzFxd0JFOHVCMXozTm44ZE5zTmlNOENsbzlQSk1RLytLenRzRFdoQXR0LzhlR1I2d0tlQTlYS09DZz09Cg==",
            url: "https://github.com/LordNayan/FindServer/blob/main/src/sparrow-app.app.tar.gz",
          },
        },
      };
      return res.status(HttpStatusCode.OK).send(data);
    }
    return res.status(HttpStatusCode.NO_CONTENT).send();
  }
}
