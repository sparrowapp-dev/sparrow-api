import {
  Body,
  Controller,
  Get,
  HttpStatus,
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
import { BodyModeEnum } from "../common/models/collection.model";
import * as yml from "js-yaml";
import axios from "axios";
import { ParserService } from "../common/services/parser.service";
import { ValidateOapiPayload } from "../workspace/payloads/collection.payload";

/**
 * App Controller
 */
@ApiBearerAuth()
@Controller()
export class AppController {
  constructor(
    private parserService: ParserService,
    private appService: AppService,
  ) {}

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
  async parseCurl(@Res() res: FastifyReply, @Req() req: FastifyRequest) {
    const parsedRequestData = await this.appService.parseCurl(req);
    return res.status(200).send(parsedRequestData);
  }

  @Post("/validate/oapi")
  @ApiHeader({
    name: "x-oapi-url",
    description: "Pass in the curl command.",
    allowEmptyValue: false,
  })
  @ApiOperation({
    summary: "Validate JSON/YAML/URL OAPI specification",
    description: "You can import a collection from jsonObj",
  })
  @ApiResponse({
    status: 200,
    description: "Provided OAPI is a valid specification.",
  })
  @ApiResponse({ status: 400, description: "Provided OAPI is invalid." })
  async validateOAPI(
    @Req() request: FastifyRequest,
    @Res() res: FastifyReply,
    @Body() body?: ValidateOapiPayload,
  ) {
    try {
      let data: any;
      const url = request.headers["x-oapi-url"] || null;
      if (url) {
        const isValidUrl = this.parserService.validateUrlIsALocalhostUrl(
          url as string,
        );
        if (!isValidUrl) throw new Error();
        const response = await axios.get(url as string);
        data = response.data;
      } else {
        const requestType = request.headers["content-type"];
        if (requestType === BodyModeEnum["application/json"]) {
          JSON.parse(body.data);
        } else if (requestType === BodyModeEnum["application/yaml"]) {
          data = yml.load(body.data);
        } else {
          throw new Error("Unsupported content type");
        }
      }
      await this.parserService.validateOapi(data);
      return res
        .status(HttpStatus.OK)
        .send({ valid: true, msg: "Provided OAPI is a valid specification." });
    } catch (error) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ valid: false, msg: "Provided OAPI is invalid." });
    }
  }
}
