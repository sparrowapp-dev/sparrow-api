import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { FastifyReply } from "fastify";
import { PinoLogger } from "nestjs-pino";

@Catch()
export class LoggingExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject("ErrorLogger") private readonly errorLogger: PinoLogger,
  ) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<FastifyReply>();
      const status = exception.getStatus();
      this.errorLogger.error(exception);
      return response.status(status).send({
        statusCode: status,
        message: exception.message,
        error: exception.name,
      });
    } else {
      throw new BadRequestException(exception);
    }
  }
}
