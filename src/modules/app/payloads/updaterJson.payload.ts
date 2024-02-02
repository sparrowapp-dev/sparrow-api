import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

export interface UpdatorJsonRequestPayload {}

export interface UpdaterJsonResponsePayload {
  statusCode: HttpStatusCode;
  data: {
    version: string;
    platforms: Platforms;
  };
}

interface Platforms {
  "windows-x86_64": PlatformData;
  "darwin-aarch64": PlatformData;
  "darwin-x86_64": PlatformData;
}

interface PlatformData {
  signature: string;
  url: string;
}
