import {
  Body,
  Controller,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminHubsService } from "../services/user-admin.hubs.service";
import { TeamService } from "@src/modules/identity/services/team.service";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import { FastifyReply } from "fastify";
import { AdminBillingService } from "../services/user-admin.billing.service";
import { BillingAddressDto } from "@src/modules/workspace/payloads/user-admin-billing.payload";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";

@Controller("api/admin")
@ApiTags("admin billing")
export class AdminBillingController {
  constructor(
    private readonly adminHubsService: AdminHubsService,
    private readonly teamService: TeamService,
    private readonly adminBillingService: AdminBillingService,
  ) {}
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("billing-addressDetails")
  @ApiOperation({ summary: "Save billing address details for the admin" })
  async saveBillingAddressDetails(
    @Body() body: BillingAddressDto,
    @Req() req: any,
    @Res() res: FastifyReply,
    @Query("teamId") teamId: string,
  ) {
    const userId = req.user._id;
    if (!userId) {
      throw new UnauthorizedException("User ID is missing from token");
    }
    const billingAddressWithUser = {
      ...body,
      userId: userId,
    };
    const data = await this.adminBillingService.saveBillingAddressDetails(
      billingAddressWithUser,
      teamId,
    );
    const responseData = new ApiResponseService(
      "Billing Address Details Saved",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
