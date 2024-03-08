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
  ApiHeader,
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
  @ApiHeader({
    name: "curl",
    description: "Pass in the curl command.",
    allowEmptyValue: false,
  })
  @ApiOperation({
    summary: "Parse Curl",
    description: "Parses the provided curl into Sparrow api request schema",
  })
  @ApiResponse({
    status: 200,
    description: "Curl parsed successfully",
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
