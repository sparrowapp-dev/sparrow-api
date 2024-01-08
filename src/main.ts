import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import headers from "@fastify/helmet";
import fastifyRateLimiter from "@fastify/rate-limit";
import { AppModule } from "@app/app.module";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import fastyfyMultipart from "@fastify/multipart";
import { FastifyInstance } from "fastify";
import { ValidationError } from "class-validator";
/**
 * The url endpoint for open api ui
 * @type {string}
 */
export const SWAGGER_API_ROOT = "api/docs";
/**
 * The name of the api
 * @type {string}
 */
export const SWAGGER_API_NAME = "API";
/**
 * A short description of the api
 * @type {string}
 */
export const SWAGGER_API_DESCRIPTION = "API Description";
/**
 * Current version of the api
 * @type {string}
 */
export const SWAGGER_API_CURRENT_VERSION = "1.0";

/**
 * Port on which the app runs.
 * @type {number}
 */
const { PORT } = process.env;

(async () => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );
  const options = new DocumentBuilder()
    .setTitle(SWAGGER_API_NAME)
    .setDescription(SWAGGER_API_DESCRIPTION)
    .setVersion(SWAGGER_API_CURRENT_VERSION)
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup(SWAGGER_API_ROOT, app, document);
  app.enableCors();
  app.register(headers);
  app.register(fastifyRateLimiter, {
    max: 100,
    timeWindow: 60000,
  });
  const fastifyInstance: FastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance
    .decorateReply("setHeader", function (name: string, value: unknown) {
      this.header(name, value);
    })
    .decorateReply("end", function () {
      this.send("");
    });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const result =
          errors[0].constraints[Object.keys(errors[0].constraints)[0]];
        throw new BadRequestException(result);
      },
    }),
  );
  app.register(fastyfyMultipart);
  await app.listen(PORT, "0.0.0.0");
})();
