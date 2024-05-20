import { Injectable } from "@nestjs/common";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import { MemoryStorageFile } from "@blazity/nest-file-fastify";
import { BlobStorageResponseDto } from "../payload/blobStorage.payload";

@Injectable()
export class BlobStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;

  constructor(private configService: ConfigService) {
    const AZURE_STORAGE_CONNECTION_STRING = this.configService.get(
      "azure.connectionString",
    );
    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      AZURE_STORAGE_CONNECTION_STRING,
    );
    this.containerClient =
      this.blobServiceClient.getContainerClient("feedbackfiles");
  }

  async getFileExtension(mimeType: string): Promise<string> {
    // const mimeToExtension: { [key: string]: string } = {
    //   "image/jpeg": ".jpeg",
    //   "image/png": ".png",
    //   "video/mp4": ".mp4",
    //   // You can add more MIME types and their corresponding extensions here if needed
    // };

    // return mimeToExtension[mimeType] || "";

    const lastSlashIndex = mimeType.lastIndexOf("/");
    if (lastSlashIndex === -1) {
      return ""; // or you could return the entire string or handle the error as needed
    }
    return mimeType.substring(lastSlashIndex + 1);
  }

  async uploadBlob(file: MemoryStorageFile): Promise<BlobStorageResponseDto> {
    const fileId = uuidv4();
    const uniqueFileName = `${fileId}-${
      file.fieldname
    }-.${await this.getFileExtension(file.mimetype)}`;
    const blockBlobClient =
      this.containerClient.getBlockBlobClient(uniqueFileName);
    await blockBlobClient.upload(file.buffer, file.buffer.length);
    const blobResponse = {
      fileId: fileId,
      fileName: file.fieldname,
      fileUrl: blockBlobClient.url,
      mimetype: file.mimetype,
    };
    return blobResponse;
  }
}
