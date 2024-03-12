import {
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
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { FastifyReply, FastifyRequest } from "fastify";
import { AppService } from "./app.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ParserService } from "../common/services/parser.service";

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
  @ApiBody({
    description: "Paste your JSON or YAML text",
    required: false,
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
  async validateOAPI(@Req() request: FastifyRequest, @Res() res: FastifyReply) {
    try {
      await this.parserService.validateOapi(request);
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
