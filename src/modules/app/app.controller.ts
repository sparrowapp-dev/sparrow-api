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
import { PostmanParserService } from "../common/services/postman.parser.service";
import { subscribePayload } from "./payloads/subscribe.payload";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ExtendedFastifyRequest } from "@src/types/fastify";
/**
 * App Controller
 */
@ApiBearerAuth()
@Controller()
export class AppController {
  constructor(
    private parserService: ParserService,
    private appService: AppService,
    private postmanParserSerivce: PostmanParserService,
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
    const { statusCode, data } =
      await this.appService.getUpdaterDetails(currentVersion);
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
  async parseCurl(
    @Body() req: curlDto,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const parsedRequestData = await this.appService.parseCurl(
      req.curl,
      user?.name ?? "anonymous",
    );
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

  @Post("/validate/file")
  @ApiHeader({
    name: "x-oapi-url",
    description: "Pass the JSON.",
    allowEmptyValue: false,
  })
  @ApiBody({
    description: "Paste your JSON of Postman Collection or OAPI",
    required: false,
  })
  @ApiOperation({
    summary: "Validate JSON OAPI specification and Postman Collection.",
    description: "You can import a collection from jsonObj.",
  })
  @ApiResponse({
    status: 200,
    description: "Provided OAPI/Postman Collection is a valid.",
  })
  @ApiResponse({
    status: 400,
    description: "Provided OAPI/Postman Collection is invalid.",
  })
  /**
   * Validates the provided OAPI or Postman Collection .
   * First, it tries to validate the OAPI specification. If that fails,
   * it attempts to validate the Postman Collection.
   *
   * @param request - The incoming request containing the OAPI/Postman data.
   * @param res - The response object to send the result.
   * @returns {Promise<FastifyReply>} The result of the validation (valid or invalid).
   * @throws {HttpStatus.BAD_REQUEST} If both OAPI and Postman formats are invalid.
   */
  async validateFile(
    @Req() request: FastifyRequest,
    @Res() res: FastifyReply,
    @Req() req: ExtendedFastifyRequest,
  ) {
    try {
      // Attempt to validate the OAPI specification in the request
      await this.parserService.validateOapi(request);
      return res.status(HttpStatus.OK).send({
        valid: true,
        msg: "Provided OAPI is a valid specification.",
        type: "OAPI",
      });
    } catch (error) {
      // If OAPI validation fails, attempt to validate the Postman collection
      try {
        const body = request.body;
        const user = req.user;
        await this.postmanParserSerivce.parsePostmanCollection(body, user);
        return res.status(HttpStatus.OK).send({
          valid: true,
          msg: "Provided Postman Collection is valid.",
          type: "POSTMAN",
        });
      } catch (error) {
        // If both OAPI and Postman validations fail, return a 400 status with an error message
        return res.status(HttpStatus.BAD_REQUEST).send({
          valid: false,
          msg: "Provided OAPI and Postman Collection format is invalid.",
          error: error,
        });
      }
    }
  }

  @Get("health")
  @ApiOperation({
    summary: "Health Check",
    description: "Checks the health of MongoDB connections.",
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
    const isMongoConnected = await this.appService.checkMongoConnection();

    if (isMongoConnected) {
      return res.status(HttpStatus.OK).send({
        statusCode: HttpStatus.OK,
        status: "healthy",
        mongo: "connected",
      });
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      status: "unhealthy",
      mongo: isMongoConnected ? "connected" : "disconnected",
    });
  }

  // Users can Subscribe to Sparrow.
  @Post("subscribe")
  @ApiResponse({ status: 200, description: "Subscription successful." })
  @ApiResponse({
    status: 400,
    description: "Please provide Email to Subscribe.",
  })
  @ApiResponse({ status: 500, description: "Failed to Subscribe." })
  async subscribeSparrow(
    @Body() req: subscribePayload,
    @Res() res: FastifyReply,
  ) {
    const { email } = req;
    const data = await this.appService.subscribeToBeehiiv(email);
    const responseData = {
      message: "Success",
      httpStatusCode: HttpStatus.OK,
      data,
    };
    return res.status(HttpStatus.OK).send(responseData);
  }

  @Post("parse-collection")
  @ApiOperation({
    summary: "Parse as OAPI JSON into Collection",
    description:
      "You can parse a OAPI JSON into collection format of sparrow collection.",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 201,
    description: "Parsed json Successfull",
  })
  @ApiResponse({ status: 400, description: "Failed to parsed Collection" })
  async importJsonCollection(
    @Res() res: FastifyReply,
    @Body() jsonObj: string,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const collectionObj = await this.parserService.parseOAPICollection(
      jsonObj,
      user,
    );

    const responseData = new ApiResponseService(
      "Collection Parsed",
      HttpStatusCode.OK,
      collectionObj,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
