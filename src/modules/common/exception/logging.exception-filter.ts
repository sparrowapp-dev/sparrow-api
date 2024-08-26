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
import { InsightsService } from "../services/insights.service";
@Catch()
export class LoggingExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject("ErrorLogger") private readonly errorLogger: PinoLogger,
    private readonly insightsService: InsightsService,
  ) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<FastifyReply>();
      const status = exception.getStatus();
      this.errorLogger.error(exception);
      const req = ctx.getRequest();
      // Create a standard Error object
      const error = new Error(exception.message);
      error.name = exception.name;
      error.stack = exception.stack;
      // Log exception to Application Insights
      const client = this.insightsService.getClient();
      client.trackException({
        exception: error,
        properties: {
          method: req.method,
          url: req.url,
          status,
        },
      });

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
