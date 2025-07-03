import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { FastifyReply } from "fastify";
// ---- Payload
import { SendSalesEmail } from "../payloads/sales-email.payload";

// ---- Services
import { ApiResponseService } from "@src/modules/common/services/api-response.service";

// ---- Enum
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

// ---- Guard
import { ExtendedFastifyRequest } from "@src/types/fastify";
import { SalesEmailService } from "../services/sales-email.service";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";

/**
 * Sales Email Controller
 *
 * This controller handles all operations related to sales email, including
 * adding, updating, deleting, and retrieving sales email.
 */
@ApiBearerAuth()
@ApiTags("Sales Email")
@Controller("api")
export class SalesEmailController {
  constructor(private readonly salesEmailService: SalesEmailService) {}

  /**
   * Add a new sales email record and send email.
   *
   * @param addFeatureDto - Data transfer object containing the mail details.
   * @param res - Fastify response object.
   */
  @Post("sales-email")
  @ApiOperation({
    summary: "Send a sales email",
    description: "Send a sales email to the customer",
  })
  @ApiResponse({ status: 201, description: "Email Sent" })
  @ApiResponse({ status: 400, description: "Failed to sent email" })
  async sendEmail(
    @Body() sendEmailDto: SendSalesEmail,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const data = await this.salesEmailService.addSalesEmailRecord(sendEmailDto);
    // Retrieve the added mail record for confirmation
    const record = await this.salesEmailService.getSalesEmailRecord(
      data.insertedId.toString(),
    );
    const responseData = new ApiResponseService(
      "Email Sent Successfully",
      HttpStatusCode.CREATED,
      record,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Fetch the record of the trial sent by email.
   *
   * @param trialId - Trial Id of the record.
   * @param res - Fastify response object.
   */
  @Get("get-trial-record/:trialId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get Trial Record",
    description: "Get the trial record of the sales email",
  })
  @ApiResponse({ status: 201, description: "Record fetched" })
  @ApiResponse({ status: 400, description: "Failed to fetch record" })
  async getTrialRecord(
    @Param("trialId") trialId: string,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    // Retrieve the added mail record for confirmation
    const record = await this.salesEmailService.getSalesEmailRecord(trialId);
    const responseData = new ApiResponseService(
      "Record Fetched Successfully",
      HttpStatusCode.OK,
      record,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
