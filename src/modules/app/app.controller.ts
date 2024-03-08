import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { FastifyReply, FastifyRequest } from "fastify";
import { AppService } from "./app.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ParseCurlBodyPayload } from "./payloads/app.payload";

/**
 * App Controller
 */
@ApiBearerAuth()
@Controller()
export class AppController {
  constructor(private appService: AppService) {}

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
    @Param("currentVersion") currentVersion: string,
  ) {
    const { statusCode, data } = await this.appService.getUpdaterDetails(
      currentVersion,
    );
    return res.status(statusCode).send(data);
  }

  @Post("curl")
  @ApiOperation({
    summary: "Parse Curl",
    description: "Parses the provided curl into Sparrow api request schema",
  })
  @ApiResponse({
    status: 200,
    description: "Curl parsed successfully",
  })
  @ApiConsumes("application/x-www-form-urlencoded")
  @ApiBody({
    schema: {
      properties: {
        curl: {
          type: "string",
          example: "Use sparrow to hit this request",
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  async parseCurl(
    @Res() res: FastifyReply,
    @Req() req: FastifyRequest<{ Body: ParseCurlBodyPayload }>,
  ) {
    const parsedRequestData = await this.appService.parseCurl(req);
    return res.status(200).send(parsedRequestData);
  }
}
