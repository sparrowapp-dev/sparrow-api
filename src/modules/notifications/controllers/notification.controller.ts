import { Controller, Get, Query, UseGuards, Req, Res } from "@nestjs/common";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { NotificationService } from "../services/notification.service";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { ExtendedFastifyRequest } from "@src/types/fastify";

@Controller("api/notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserNotifications(
    @Query("page") page = "1",
    @Query("limit") limit = "10",
    @Query("includeArchived") includeArchived = "false",
    @Req() request: ExtendedFastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const userId = request.user._id;

    const data = await this.notificationService.getUserNotifications(
      userId,
      parseInt(page),
      parseInt(limit),
      includeArchived === "true",
    );

    const response = new ApiResponseService(
      "Notifications fetched successfully",
      HttpStatusCode.OK,
      data,
    );

    return res.status(response.httpStatusCode).send(response);
  }
}
