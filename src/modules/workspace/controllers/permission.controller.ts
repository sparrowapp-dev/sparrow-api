import { Controller, Body, UseGuards, Put, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PermissionService } from "../services/permission.service";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { UpdatePermissionDto } from "../payloads/permission.payload";
/**
 * Permission Controller
 */
@ApiBearerAuth()
@ApiTags("permission")
@Controller("api/permission")
@UseGuards(JwtAuthGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Put(":workspaceId/user/:userId")
  @ApiOperation({
    summary: "Update a User's Permisson in a Workspace",
    description: "This will update a User's Permisson in a Workspace",
  })
  @ApiResponse({ status: 200, description: "Workspace Updated Successfully" })
  @ApiResponse({ status: 400, description: "Update Workspace Failed" })
  async updateWorkspace(
    @Param("workspaceId") workspaceId: string,
    @Param("userId") userId: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
    @Res() res: FastifyReply,
  ) {
    const workspace = await this.permissionService.updatePermissionInWorkspace({
      workspaceId,
      userId,
      role: updatePermissionDto.role,
    });

    const responseData = new ApiResponseService(
      "Permission Update",
      HttpStatusCode.OK,
      workspace,
    );
    res.status(responseData.httpStatusCode).send(responseData);
  }
}
