import { Injectable, NestMiddleware } from "@nestjs/common";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { FastifyRequest, FastifyReply } from "fastify";
import { Counter, Gauge, Registry } from "prom-client";
import { UserMetricsService } from "../../user-metrics/services/user-metrics.service";
import { ExtendedFastifyRequest } from "@src/types/fastify";

@Injectable()
export class CustomMetricsMiddleware implements NestMiddleware {
  private registry: Registry;
  private customDurationGauge: Gauge<string>;
  private customErrorsCounter: Counter<string>;

  constructor(
    @InjectMetric("count") private readonly appCounter: Counter<string>,
    @InjectMetric("gauge") private readonly appGauge: Gauge<string>,
    @InjectMetric("app_duration_metrics") private readonly durationGauge: Gauge,
    private readonly userMetricsService: UserMetricsService,
  ) {
    // Create a new registry
    this.registry = new Registry();

    // Initialize custom metrics
    this.customDurationGauge = new Gauge({
      name: "app_duration_metrics",
      help: "app_concurrent_metrics_help",
      labelNames: ["method", "origin", "status", "environment"],
      registers: [this.registry],
    });

    this.customErrorsCounter = new Counter({
      name: "app_error_metrics",
      help: "app_usage_metrics_to_detect_errors",
      labelNames: ["method", "origin", "status", "environment"],
      registers: [this.registry],
    });

    // Register metrics
    this.registry.registerMetric(this.customDurationGauge);
    this.registry.registerMetric(this.customErrorsCounter);
  }

  use(req: FastifyRequest["raw"], res: FastifyReply["raw"], next: () => void) {
    try {
      // Get the request method and path
      const method = req.method || "UNKNOWN";
      const origin = req.url || "/unknown";

      // Extract user ID from JWT token if present
      const userId = this.extractUserIdFromRequest(req);

      // Create initial labels object
      const initialLabels = {
        method,
        origin,
        status: "200", // Initial default, will be updated with actual status
        environment: process.env.APP_ENV || "NA",
      };

      // Increment the gauge for active requests
      this.appGauge.inc(initialLabels);

      // Increment the main counter
      this.appCounter.inc(initialLabels);

      // Record start time
      const startTime = Date.now();

      // In NestJS with Fastify, we need to add our listeners to the raw response
      const originalEnd = res.end;

      // Override the end method to capture when the response is complete
      res.end = function (...args: any[]) {
        // Call the original end method first
        const result = originalEnd.apply(res, args);

        // Get the actual status code from the response
        const statusCode = res.statusCode || 200;

        // Create final labels with actual status code
        const finalLabels = {
          method,
          origin: req.url || "/unknown",
          status: statusCode.toString(),
          environment: process.env.APP_ENV || "NA",
        };

        // Calculate duration
        const duration = Date.now() - startTime;

        // Now set metrics after response has been sent
        try {
          // Set duration metric with final status
          this.customDurationGauge.set(finalLabels, duration);
          this.durationGauge.set(finalLabels, duration);

          // Decrement the gauge using initial labels to ensure correct tracking
          this.appGauge.dec(initialLabels);

          // Increment counter again with final status
          this.appCounter.inc(finalLabels);

          // Track errors
          if (statusCode >= 400) {
            this.customErrorsCounter.inc(finalLabels);
          }

          // Track user activity if user ID is available
          if (userId) {
            this.userMetricsService
              .trackUserActivity(userId, {
                method,
                origin: req.url || "/unknown",
                status: statusCode.toString(),
                timestamp: new Date(),
                environment: process.env.APP_ENV || "development",
              })
              .catch((err: any) => {
                console.error("Error tracking user activity:", err);
              });
          }
        } catch (err) {
          console.error("Error updating metrics:", err);
        }

        return result;
      }.bind(this);

      next();
    } catch (error) {
      // Ensure gauge is decremented even if there's an error
      this.appGauge.dec();
      console.error("Error in metrics middleware:", error);
      next();
    }
  }

  /**
   * Extract user ID from JWT token in the Authorization header
   */
  private extractUserIdFromRequest(req: FastifyRequest["raw"]): string | null {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix
      if (!token) {
        return null;
      }

      // Decode JWT token (without verification since we just need the user ID)
      // The token will be properly verified later by the JWT guard
      const payload = this.decodeJwtPayload(token);
      return payload?._id || null;
    } catch (error) {
      // Silently fail - this is not critical for metrics
      return null;
    }
  }

  /**
   * Decode JWT payload without verification (for metrics purposes only)
   */
  private decodeJwtPayload(token: string): any {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      const decoded = Buffer.from(payload, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch (error) {
      return null;
    }
  }
}
