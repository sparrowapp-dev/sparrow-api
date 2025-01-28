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
import { CustomWebSocketAdapter } from "./modules/proxy/adapters/custom-websocket-adapter";

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

/**
 * Initializes and configures the NestJS application.
 * Function sets up routes, Swagger documentation, CORS, rate limiting,
 * global validation pipes, multipart form data handling, and starts the server.
 */
(async () => {
  // Create the NestJS application with Fastify adapter
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, bodyLimit: 50 * 1024 * 1024 }), // Set logger and body limit
  );

  // Use the custom WebSocket adapter to handle both WS and SocketIo
  // app.useWebSocketAdapter(new CustomWebSocketAdapter(app));

  // Configure Swagger options for API documentation
  const options = new DocumentBuilder()
    .setTitle(SWAGGER_API_NAME)
    .setDescription(SWAGGER_API_DESCRIPTION)
    .setVersion(SWAGGER_API_CURRENT_VERSION)
    .addBearerAuth() // Add bearer token authentication to Swagger
    .build();
  const document = SwaggerModule.createDocument(app, options);

  // Setup Swagger UI endpoint
  SwaggerModule.setup(SWAGGER_API_ROOT, app, document);

  // Enable Cross-Origin Resource Sharing (CORS)
  app.enableCors();

  // Register additional Fastify plugins
  app.register(headers);
  app.register(fastifyRateLimiter, {
    max: 100,
    timeWindow: 60000,
  });

  // Get the underlying FastifyInstance for additional customizations
  const fastifyInstance: FastifyInstance = app.getHttpAdapter().getInstance();

  // Extend Fastify reply with custom methods
  fastifyInstance
    .decorateReply("setHeader", function (name: string, value: unknown) {
      this.header(name, value); // Set HTTP response header
    })
    .decorateReply("end", function () {
      this.send(""); // End response with an empty body
    });

  // Apply global validation pipe for request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips non-decorated properties from objects
      exceptionFactory: (errors: ValidationError[]) => {
        const result =
          errors[0].constraints[Object.keys(errors[0].constraints)[0]];
        throw new BadRequestException(result);
      },
    }),
  );
  // Register multipart form data handling for file uploads with increased limits
  app.register(fastyfyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // Set file size limit to 50MB
    },
  });

  // Start the server and listen on all available network interfaces
  await app.listen(PORT, "0.0.0.0");
})();
