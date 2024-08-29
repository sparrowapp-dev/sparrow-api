import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

// ---- Third Party Libraries
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";
import { MemoryStorageFile } from "@blazity/nest-file-fastify";

// ---- Model
import { FeedbackFiles } from "../models/feedback.model";

/**
 * Handle Azure Blob Storage operations.
 */
@Injectable()
export class BlobStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;

  /**
   * Constructor to initialize BlobStorageService with required dependencies.
   * @param configService - Injected ConfigService to access environment variables.
   */
  constructor(private configService: ConfigService) {
    const AZURE_STORAGE_CONNECTION_STRING = this.configService.get(
      "azure.connectionString",
    );
    const feedbackBlobContainer = this.configService.get(
      "feedbackBlob.container",
    );
    /**
     * Create an instance of BlobServiceClient using the connection string.
     */
    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      AZURE_STORAGE_CONNECTION_STRING,
    );
    /**
     * Get a ContainerClient instance for the 'feedbackfiles' container.
     */
    this.containerClient = this.blobServiceClient.getContainerClient(
      feedbackBlobContainer,
    );
  }

  /**
   * Extracts and returns the file extension from the provided MIME type.
   * @param mimeType - The MIME type of the file.
   * @returns Updated file type.
   */
  async getFileExtension(mimeType: string): Promise<string> {
    const lastSlashIndex = mimeType.lastIndexOf("/");
    if (lastSlashIndex === -1) {
      return ""; // Return an empty string if MIME type format is invalid
    }
    return mimeType.substring(lastSlashIndex + 1);
  }

  /**
   * Uploads a file to Azure Blob Storage.
   * @param file - file that needs to be uploaded, represented by MemoryStorageFile.
   * @returns FeedbackFiles object containing metadata about the uploaded file.
   */
  async uploadBlob(file: MemoryStorageFile): Promise<FeedbackFiles> {
    const fileId = uuidv4();
    const uniqueFileName = `${fileId}-${
      file.fieldname
    }.${await this.getFileExtension(file.mimetype)}`;
    const blockBlobClient =
      this.containerClient.getBlockBlobClient(uniqueFileName);

    // Set Content-Type and Content-Disposition headers
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: file.mimetype, // Set the MIME type
        blobContentDisposition: "inline", // Display the image inline in the browser
      },
    };

    await blockBlobClient.upload(
      file.buffer,
      file.buffer.length,
      uploadOptions,
    );
    const blobResponse = {
      fileId: fileId,
      fileName: file.fieldname,
      fileUrl: blockBlobClient.url,
      mimetype: file.mimetype,
    };
    return blobResponse;
  }
}
