// insights.service.ts
/**
 * The `InsightsService` class provides a wrapper around Microsoft Application Insights,
 * allowing for telemetry data to be sent to Azure from your NestJS application. This service
 * is responsible for initializing Application Insights and providing access to the telemetry client.
 *
 * @class InsightsService
 */
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as appInsights from "applicationinsights";

@Injectable()
export class InsightsService {
  private readonly client = appInsights.defaultClient;
  /**
   * Creates an instance of `InsightsService`.
   * The constructor initializes Application Insights if it hasn't been initialized already.
   *
   * @param {ConfigService} configService - The NestJS `ConfigService` used to retrieve the
   * Azure Application Insights connection string from environment variables.
   */
  constructor(private configService: ConfigService) {
    // Ensure Application Insights is initialized only once
    const azureInsightsConnectionString = this.configService.get(
      "azure.insightsConnectionString",
    );
    if (!azureInsightsConnectionString) {
      console.warn(
        "Application Insights is disabled: No connection string provided.",
      );
      return;
    }

    if (!this.client) {
      try {
        appInsights
          .setup(azureInsightsConnectionString)
          .setAutoDependencyCorrelation(true)
          .setAutoCollectRequests(true)
          .setAutoCollectPerformance(true, true)
          .setAutoCollectExceptions(true)
          .setAutoCollectDependencies(true)
          .setAutoCollectConsole(true)
          .setUseDiskRetryCaching(true)
          .setSendLiveMetrics(true)
          .start();
        this.client = appInsights.defaultClient;
      } catch (e) {
        console.error(e);
      }
    }
  }

  /**
   * Retrieves the Application Insights telemetry client.
   *
   * @returns {appInsights.TelemetryClient} - The Application Insights telemetry client.
   */
  getClient() {
    return this.client;
  }
}
