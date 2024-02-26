import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpStatusCode } from "../common/enum/httpStatusCode.enum";
import { UpdaterJsonResponsePayload } from "./payloads/updaterJson.payload";

/**
 * Application Service
 */
@Injectable()
export class AppService {
  /**
   * Constructor
   * @param {ConfigService} config configuration service
   */
  constructor(private config: ConfigService) {}

  getUpdaterDetails(currentVersion: string): UpdaterJsonResponsePayload {
    if (
      this.config.get("updater.updateAvailable") === "true" &&
      currentVersion < this.config.get("updater.appVersion")
    ) {
      const updatorJson = {
        version: this.config.get("updater.appVersion"),
        platforms: {
          "windows-x86_64": {
            signature: this.config.get("updater.windows.appSignature"),
            url: this.config.get("updater.windows.appUrl"),
          },
          "darwin-aarch64": {
            signature: this.config.get("updater.macAppleSilicon.appSignature"),
            url: this.config.get("updater.macAppleSilicon.appUrl"),
          },
          "darwin-x86_64": {
            signature: this.config.get("updater.macIntel.appSignature"),
            url: this.config.get("updater.macIntel.appUrl"),
          },
        },
      };
      return {
        statusCode: HttpStatusCode.OK,
        data: updatorJson,
      };
    }
    return {
      statusCode: HttpStatusCode.NO_CONTENT,
      data: null,
    };
  }
}
