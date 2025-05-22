import { All, Controller, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

// ---- Fastify
import { FastifyReply, FastifyRequest } from "fastify";

// ---- Enum
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { MockServerService } from "../services/mock-server.service";

/**
 * Mock Server Controller
 */
@ApiBearerAuth()
@ApiTags("mock-server")
@Controller("api/mock") // Base route for this controller
export class MockServerController {
  constructor(private readonly mockServerService: MockServerService) {}

  /**
   * Mock Server requests route, catches all the mock requests.
   */
  @ApiOperation({
    summary: "Get the mock server request",
    description:
      "All the mock server requests will come here and return saved response.",
  }) // Provides metadata for this operation in Swagger documentation
  @ApiResponse({
    status: 201,
    description: "Received Mock request succcessfully",
  })
  @ApiResponse({ status: 400, description: "Failed to receive mock request" })
  @All("*")
  async getMockRequests(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const response = await this.mockServerService.handleMockRequests(req);
    if (response?.contentType) {
      res.header("Content-Type", response.contentType);
    }
    return res.status(response.status).send(response.body);
  }
}
