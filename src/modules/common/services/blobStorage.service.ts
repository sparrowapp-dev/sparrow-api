import { BadRequestException, Injectable } from "@nestjs/common";
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
  private aiContainerClient: ContainerClient;
  private downGradeHubClient: ContainerClient;

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
    const aiConversationBLobContainer = this.configService.get(
      "ai.conversationConatiner",
    );

    try {
      /**
       * Create an instance of BlobServiceClient using the connection string.
       */

      const azureConnectionString = this.configService.get(
        "azure.connectionString",
      );

      if (!azureConnectionString) {
        console.warn(
          "Azure Storage is disabled: No connection string provided.",
        );
        return;
      }

      const feedbackBlobContainer = this.configService.get(
        "feedbackBlob.container",
      );

      if (!feedbackBlobContainer) {
        console.warn("Feedback Blob is disabled: No container provided.");
        return;
      }

      const aiConversationBLobContainer = this.configService.get(
        "ai.conversationConatiner",
      );

      if (!aiConversationBLobContainer) {
        console.warn(
          "AI Conversation Blob is disabled: No container provided.",
        );
        return;
      }

      const downgradeHubBlobContainer = this.configService.get(
        "downgradeHub.container",
      );

      if (!downgradeHubBlobContainer) {
        console.warn("Downgrade Blob is disabled: No container provided.");
        return;
      }

      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        azureConnectionString,
      );
      /**
       * Get a ContainerClient instance for the 'feedbackfiles' container.
       */
      this.containerClient = this.blobServiceClient.getContainerClient(
        feedbackBlobContainer,
      );
      /**
       * Get a ContainerClient instance for the 'AI Conversation Doc' container.
       */
      this.aiContainerClient = this.blobServiceClient.getContainerClient(
        aiConversationBLobContainer,
      );
      this.downGradeHubClient = this.blobServiceClient.getContainerClient(
        downgradeHubBlobContainer,
      );
    } catch (e) {
      console.error(e);
    }
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
    if (!this.containerClient) {
      throw new BadRequestException(
        "Azure blob container is not connected to backend server.",
      );
    }
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

  /**
   * Uploads a AI Document to Azure Blob Storage.
   * @param file - file that needs to be uploaded, represented by MemoryStorageFile.
   * @returns AI Doc object containing metadata about the uploaded file.
   */
  async uploadAiDoc(file: MemoryStorageFile): Promise<string> {
    const fileId = uuidv4();
    const name = await this.getFileExtension(file.mimetype);
    const uniqueFileName = `${fileId}-${
      file.fieldname
    }.${name}`;
    if (!this.aiContainerClient) {
      throw new BadRequestException(
        "Azure blob container is not connected to backend server.",
      );
    }
    const blockBlobClient =
      this.aiContainerClient.getBlockBlobClient(uniqueFileName);

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
    
    const docURL = blockBlobClient.url;
    return docURL;
  }

  /**
   * Uploads an Excel Document to Azure Blob Storage.
   * @param buffer - Buffer containing the Excel file data
   * @param storageName - Name used for storing the file in blob (with timestamp)
   * @param downloadName - Name shown when user downloads the file (clean name)
   * @param mimetype - MIME type of the file (Excel format) or file extension (e.g., ".xlsx")
   * @returns Object containing fileId and fileUrl
   */
  async uploadExcelBlob(
    buffer: Buffer,
    storageName: string,
    downloadName: string,
    mimetype: string,
  ): Promise<{ fileUrl: string; fileId: string }> {
    const fileId = uuidv4();
    // Handle both full MIME type and file extension
    let fileExtension: string;
    let contentType: string;
    if (mimetype.startsWith(".")) {
      // If mimetype is an extension like ".xlsx"
      fileExtension = mimetype.substring(1); // Remove the dot
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      // If mimetype is a full MIME type
      fileExtension = await this.getFileExtension(mimetype);
      contentType = mimetype;
    }
    const uniqueFileName = `${fileId}-${storageName}.${fileExtension}`;
    if (!this.downGradeHubClient) {
      throw new BadRequestException(
        "Azure blob container is not connected to backend server.",
      );
    }
    const blockBlobClient =
      this.downGradeHubClient.getBlockBlobClient(uniqueFileName);
    // Set Content-Type and Content-Disposition headers for Excel download
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: contentType,
        blobContentDisposition: `attachment; filename="${downloadName}.${fileExtension}"`, 
      },
    };
    await blockBlobClient.upload(buffer, buffer.length, uploadOptions);
    return {
      fileId: fileId,
      fileUrl: blockBlobClient.url,
    };
  }

  async deleteAiDocByUrl(fileUrl: string): Promise<string> {
  if (!this.aiContainerClient) {
    throw new BadRequestException(
      'Azure blob container is not connected to backend server.',
    );
  }

  try {
    const url = new URL(fileUrl);

    // Extract the blob name from the URL (everything after the last '/')
    const blobName = decodeURIComponent(url.pathname.split('/').pop() || '');

    if (!blobName) {
      throw new BadRequestException('Invalid file URL');
    }

    const blockBlobClient = this.aiContainerClient.getBlockBlobClient(blobName);

    const result = await blockBlobClient.deleteIfExists();

    return "success"

  } catch (error) {
    console.error('Error deleting file from Azure Blob Storage:', error.message);
  }
}

}
