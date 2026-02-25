import { Controller, Get, Query, UseGuards, Req, Res } from "@nestjs/common";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { NotificationService } from "../services/notification.service";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { ExtendedFastifyRequest } from "@src/types/fastify";
import { Param, Patch, Post, Body } from "@nestjs/common";

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

  @Patch(":id/read")
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Param("id") id: string, @Res() res: FastifyReply) {
    await this.notificationService.markAsRead(id);

    const response = new ApiResponseService(
      "Notification marked as read",
      HttpStatusCode.OK,
    );

    return res.status(response.httpStatusCode).send(response);
  }

  @Patch(":id/archive")
  @UseGuards(JwtAuthGuard)
  async archive(@Param("id") id: string, @Res() res: FastifyReply) {
    await this.notificationService.archive(id);

    const response = new ApiResponseService(
      "Notification archived",
      HttpStatusCode.OK,
    );

    return res.status(response.httpStatusCode).send(response);
  }

  @Patch("read-all")
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(
    @Req() request: ExtendedFastifyRequest,
    @Res() res: FastifyReply,
  ) {
    await this.notificationService.markAllAsRead(request.user._id);

    const response = new ApiResponseService(
      "All notifications marked as read",
      HttpStatusCode.OK,
    );

    return res.status(response.httpStatusCode).send(response);
  }

  @Post(":id/respond")
  @UseGuards(JwtAuthGuard)
  async respondToInvite(
    @Param("id") id: string,
    @Body() body: { action: "accept" | "reject" },
    @Req() request: ExtendedFastifyRequest,
    @Res() res: FastifyReply,
  ) {
    await this.notificationService.respondToWorkspaceInvite(
      id,
      body.action,
      request.user.email,
    );

    const response = new ApiResponseService(
      "Invite response recorded",
      HttpStatusCode.OK,
    );

    return res.status(response.httpStatusCode).send(response);
  }
}
