import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

// ---- Fastify
import { FastifyReply } from "fastify";
import {
  FilesInterceptor,
  MemoryStorageFile,
  UploadedFiles,
} from "@blazity/nest-file-fastify";

// ---- Guard
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";

// ---- Payload
import { AddFeedbackDto } from "../payloads/feedback.payload";

// ---- Enum
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

// ---- Services
import { FeedbackService } from "../services/feedback.service";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { ExtendedFastifyRequest } from "@src/types/fastify";

/**
 * Feedback Controller
 */
@ApiBearerAuth()
@ApiTags("feedback")
@Controller("api/feedback") // Base route for this controller
@UseGuards(JwtAuthGuard) // JWT authentication guard to protect routes
export class FeedbackController {
  /**
   * Constructor to initialize FeedbackController with the required service.
   * @param feedbackService - Injected FeedbackService to handle business logic.
   */
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * Endpoint to add a new feedback.
   * @param addFeedbackDto - Data transfer object containing feedback details.
   * @param res - Fastify reply object to send the response.
   * @param files - Array of files needs to be uploaded.
   */
  @Post()
  @ApiOperation({
    summary: "Add a Feedback",
    description: "You can add a Feedback",
  }) // Provides metadata for this operation in Swagger documentation
  @ApiConsumes("multipart/form-data") // Specifies that this endpoint consumes multipart/form-data
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "string",
            format: "binary",
          },
          maxItems: 5,
        },
        type: {
          type: "string",
        },
        subCategory: {
          type: "string",
        },
        subject: {
          type: "string",
        },
        description: {
          type: "string",
        },
      },
    },
  }) // Defines the structure of the request body for Swagger documentation
  @UseInterceptors(FilesInterceptor("files", 5)) // NestJS FilesInterceptor to handle file uploads, limiting to 5 files
  @ApiResponse({ status: 201, description: "Feedback Added" })
  @ApiResponse({ status: 400, description: "Failed to add Feedback" })
  async addFeedback(
    @Body() addFeedbackDto: AddFeedbackDto,
    @Res() res: FastifyReply,
    @UploadedFiles()
    files: MemoryStorageFile[],
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const feature = await this.feedbackService.addFeedback(
      addFeedbackDto,
      files,
      user._id,
    ); // Calls the feedback service to add new feedback
    const responseData = new ApiResponseService(
      "Feedback Added",
      HttpStatusCode.CREATED,
      feature,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to upload files.
   * @param res - Fastify reply object to send the response.
   * @param files - Array of files needs to be uploaded.
   */
  @Post("uploads")
  @ApiOperation({
    summary: "Upload Files",
    description: "You can upload the images in blob",
  }) // Provides metadata for this operation in Swagger documentation
  @ApiConsumes("multipart/form-data") // Specifies that this endpoint consumes multipart/form-data
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "string",
            format: "binary",
          },
          maxItems: 5,
        },
      },
    },
  }) // Defines the structure of the request body for Swagger documentation
  @UseInterceptors(FilesInterceptor("files", 5)) // NestJS FilesInterceptor to handle file uploads, limiting to 5 files
  @ApiResponse({ status: 201, description: "File Uploaded" })
  @ApiResponse({ status: 400, description: "Failed to upload files" })
  async uploadFeedbackFile(
    @Res() res: FastifyReply,
    @UploadedFiles()
    files: MemoryStorageFile[],
  ) {
    const uploads = await this.feedbackService.uploadFeedbackFile(files); // Calls the feedback service to add new feedback

    const responseData = new ApiResponseService(
      "Files Uploaded",
      HttpStatusCode.CREATED,
      uploads,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
