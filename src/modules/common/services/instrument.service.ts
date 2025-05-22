import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InstrumentService {
  constructor(private readonly configService: ConfigService) {
    // Retrieve Sentry configuration using ConfigService
    const sentryDsn = this.configService.get<string>("sentry.dsn");
    const sentryEnvironment =
      this.configService.get<string>("sentry.environment");

    if (sentryEnvironment !== "LOCAL-BE" && sentryDsn && sentryEnvironment) {
      Sentry.init({
        dsn: sentryDsn,
        environment: sentryEnvironment,
        beforeSend: (event) => {
            return event;
        },
        // Setting this option to true will send default PII data to Sentry.
        sendDefaultPii: true,
      });
    }
  }
}
