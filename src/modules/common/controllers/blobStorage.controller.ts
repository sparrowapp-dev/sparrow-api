import { Controller, Post, UseInterceptors, Res } from "@nestjs/common";
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from "@blazity/nest-file-fastify";
import { BlobStorageService } from "../services/blobStorage.service";
import { FastifyReply } from "fastify";

@Controller("blob")
export class BlobStorageController {
  constructor(private readonly blobStorageService: BlobStorageService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(
    @Res() res: FastifyReply,
    @UploadedFile()
    file: MemoryStorageFile,
  ) {
    const data = await this.blobStorageService.uploadBlob(file);
    return res.status(200).send(data);
  }
}
