import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
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
import { ParserService } from "../common/services/parser.service";
import { ApiResponseService } from "../common/services/api-response.service";
import { HttpStatusCode } from "../common/enum/httpStatusCode.enum";
import { curlDto } from "./payloads/curl.payload";

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
      type: "object",
      properties: {
        curl: {
          type: "string",
          example: "Use sparrow to hit this request",
        },
      },
    },
  })
  async parseCurl(@Body() req: curlDto, @Res() res: FastifyReply) {
    const parsedRequestData = await this.appService.parseCurl(req.curl);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      parsedRequestData,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
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

  @Get("health")
  @ApiOperation({
    summary: "Health Check",
    description: "Checks the health of Kafka and MongoDB connections.",
  })
  @ApiResponse({
    status: 200,
    description: "Health check successful.",
  })
  @ApiResponse({
    status: 500,
    description: "Health check failed.",
  })
  async healthCheck(@Res() res: FastifyReply) {
    const isKafkaConnected = await this.appService.checkKafkaConnection();
    const isMongoConnected = await this.appService.checkMongoConnection();

    if (isKafkaConnected && isMongoConnected) {
      return res.status(HttpStatus.OK).send({
        statusCode: HttpStatus.OK,
        status: "healthy",
        kafka: "connected",
        mongo: "connected",
      });
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      status: "unhealthy",
      kafka: isKafkaConnected ? "connected" : "disconnected",
      mongo: isMongoConnected ? "connected" : "disconnected",
    });
  }
}
