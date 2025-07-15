import { BadRequestException, Injectable } from "@nestjs/common";
import { InsertOneResult, ObjectId } from "mongodb";
import { MemoryStorageFile } from "@blazity/nest-file-fastify";

// ---- Repository
import { FeedbackRepository } from "../repositories/feedback.repository";

// ---- Payload
import { AddFeedbackDto } from "../payloads/feedback.payload";

// ---- Service
import { BlobStorageService } from "@src/modules/common/services/blobStorage.service";

// ---- Model
import {
  Feedback,
  FeedbackFiles,
} from "@src/modules/common/models/feedback.model";
import {
  ErrorMessages,
  FeedbackErrorMessages,
} from "@src/modules/common/enum/error-messages.enum";

/**
 * Feedback Service
 */
@Injectable()
export class FeedbackService {
  /**
   * Constructor for Feedback Service.
   * @param feedbackRepository Repository handling database operations for feedback.
   * @param blobStorageService Service handling blob storage operations.
   * @param  Info about User.
   */
  constructor(
    private readonly feedbackRepository: FeedbackRepository,
    private readonly blobStorageService: BlobStorageService,
  ) {}

  /**
   * Validates the uploaded feedback files.
   * @param files Array of files to be validated.
   * @returns True if the files are valid.
   * @throws BadRequestException if the validation fails.
   */
  async isFeedbackFilesValid(files: MemoryStorageFile[]): Promise<boolean> {
    const mimeToExtension: { [key: string]: string } = {
      "image/jpeg": ".jpeg",
      "image/png": ".png",
      // "application/pdf": ".pdf", // Disabling the pdf support for now
      // You can add more MIME types and their corresponding extensions here if needed
    };
    if (files.length > 5) {
      throw new BadRequestException(FeedbackErrorMessages.FilesCountLimit);
    }

    let videoCount = 0;
    files.forEach((file) => {
      if (file.mimetype === "video/mp4") {
        videoCount++;
        if (videoCount > 1) {
          throw new BadRequestException(FeedbackErrorMessages.VideoCountLimit);
        }
        if (file.size > 10485760) {
          throw new BadRequestException(FeedbackErrorMessages.VideoSizeLimit);
        }
      } else if (mimeToExtension[file.mimetype] && file.size > 2097152) {
        throw new BadRequestException(FeedbackErrorMessages.ImageSizeLimit);
      } else if (!mimeToExtension[file.mimetype]) {
        throw new BadRequestException(ErrorMessages.InvalidFile);
      }
    });
    return true;
  }

  /**
   * Adds a feedback entry along with its associated files.
   * @param feedback The feedback data transfer object.
   * @param files Array of files associated with the feedback.
   * @returns Feedback with inserted document ID.
   */
  async addFeedback(
    feedback: AddFeedbackDto,
    files: MemoryStorageFile[],
    userId: ObjectId,
  ): Promise<InsertOneResult<Feedback>> {
    // Validate the uploaded files
    await this.isFeedbackFilesValid(files);

    // Upload all files to the blob storage service in parallel
    const uploadResults = await Promise.all(
      files.map((file) => this.blobStorageService.uploadBlob(file)),
    );

    // Prepare parameters for inserting feedback into the database
    const uploadFeedbackParams = {
      ...feedback,
      files: uploadResults,
      createdBy: userId.toString(),
      createdAt: new Date(),
    };

    // Insert the feedback into the database
    const response =
      await this.feedbackRepository.addFeedback(uploadFeedbackParams);
    return response;
  }

  /**
   * Validates the uploaded feedback files.
   * @param files Array of files to be validated.
   * @returns True if the files are valid.
   * @throws BadRequestException if the validation fails.
   */
  async isUploadFilesValid(files: MemoryStorageFile[]): Promise<boolean> {
    const mimeToExtension: { [key: string]: string } = {
      "image/jpeg": ".jpeg",
      "image/png": ".png",
      "image/jpg": ".jpg",
      "image/svg+xml": ".svg",
      // You can add more MIME types and their corresponding extensions here if needed
    };
    if (files.length > 5) {
      throw new BadRequestException(FeedbackErrorMessages.FilesCountLimit);
    }

    files.forEach((file) => {
      if (mimeToExtension[file.mimetype] && file.size > 2097152) {
        throw new BadRequestException(FeedbackErrorMessages.ImageSizeLimit);
      } else if (!mimeToExtension[file.mimetype]) {
        throw new BadRequestException(ErrorMessages.InvalidFile);
      }
    });
    return true;
  }

  async uploadFeedbackFile(
    files: MemoryStorageFile[],
  ): Promise<FeedbackFiles[]> {
    // Validate the uploaded files
    await this.isUploadFilesValid(files);

    // Upload all files to the blob storage service in parallel
    const uploadResults = await Promise.all(
      files.map((file) => this.blobStorageService.uploadBlob(file)),
    );
    return uploadResults;
  }
}
