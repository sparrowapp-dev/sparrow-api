import { Injectable, NestMiddleware } from "@nestjs/common";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { FastifyRequest, FastifyReply } from "fastify";
import { Counter, Gauge, Registry } from "prom-client";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CustomMetricsMiddleware implements NestMiddleware {
  private registry: Registry;
  private customDurationGauge: Gauge<string>;
  private customErrorsCounter: Counter<string>;
  private uniqueUsersGauge: Gauge<string>;
  private userRequestsCounter: Counter<string>;
  private activeUsersGauge: Gauge<string>;

  // In-memory tracking for unique users
  private uniqueUsers: Set<string> = new Set();
  private activeUsers: Map<string, number> = new Map(); // userId -> last activity timestamp
  private readonly ACTIVE_USER_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(
    @InjectMetric("count") private readonly appCounter: Counter<string>,
    @InjectMetric("gauge") private readonly appGauge: Gauge<string>,
    @InjectMetric("app_duration_metrics") private readonly durationGauge: Gauge,
    @InjectMetric("unique_users_total") private readonly uniqueUsersMetric: Gauge<string>,
    @InjectMetric("user_requests_total") private readonly userRequestsMetric: Counter<string>,
    @InjectMetric("active_users_current") private readonly activeUsersMetric: Gauge<string>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

    // Initialize user tracking metrics
    this.uniqueUsersGauge = new Gauge({
      name: "unique_users_total",
      help: "Total number of unique users that have accessed the system",
      labelNames: ["environment"],
      registers: [this.registry],
    });

    this.userRequestsCounter = new Counter({
      name: "user_requests_total",
      help: "Total number of requests per user",
      labelNames: ["user_id", "method", "status", "environment"],
      registers: [this.registry],
    });

    this.activeUsersGauge = new Gauge({
      name: "active_users_current",
      help: "Number of currently active users (within last 30 minutes)",
      labelNames: ["environment"],
      registers: [this.registry],
    });

    // Register metrics
    this.registry.registerMetric(this.customDurationGauge);
    this.registry.registerMetric(this.customErrorsCounter);
    this.registry.registerMetric(this.uniqueUsersGauge);
    this.registry.registerMetric(this.userRequestsCounter);
    this.registry.registerMetric(this.activeUsersGauge);

    // Start cleanup interval for active users
    this.startActiveUsersCleanup();
  }

  /**
   * Starts a periodic cleanup of inactive users
   */
  private startActiveUsersCleanup() {
    setInterval(() => {
      this.cleanupInactiveUsers();
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Removes users who haven't been active within the timeout period
   */
  private cleanupInactiveUsers() {
    const now = Date.now();
    const environment = process.env.APP_ENV || "NA";

    for (const [userId, lastActivity] of this.activeUsers.entries()) {
      if (now - lastActivity > this.ACTIVE_USER_TIMEOUT) {
        this.activeUsers.delete(userId);
      }
    }

    // Update active users gauge
    this.activeUsersGauge.set({ environment }, this.activeUsers.size);
    this.activeUsersMetric.set({ environment }, this.activeUsers.size);
  }

  /**
   * Extracts user ID from JWT token in the request
   */
  private extractUserIdFromRequest(req: FastifyRequest["raw"]): string | null {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7);
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get("app.jwtSecretKey"),
      });

      return decoded._id || null;
    } catch (error) {
      // Token is invalid or expired, return null
      return null;
    }
  }

  /**
   * Updates user tracking metrics
   */
  private updateUserMetrics(userId: string, method: string, statusCode: number) {
    const environment = process.env.APP_ENV || "NA";
    const now = Date.now();

    // Track unique users
    if (!this.uniqueUsers.has(userId)) {
      this.uniqueUsers.add(userId);
      this.uniqueUsersGauge.set({ environment }, this.uniqueUsers.size);
      this.uniqueUsersMetric.set({ environment }, this.uniqueUsers.size);
    }

    // Track active users
    this.activeUsers.set(userId, now);
    this.activeUsersGauge.set({ environment }, this.activeUsers.size);
    this.activeUsersMetric.set({ environment }, this.activeUsers.size);

    // Track user requests
    const userRequestLabels = {
      user_id: userId,
      method,
      status: statusCode.toString(),
      environment,
    };
    this.userRequestsCounter.inc(userRequestLabels);
    this.userRequestsMetric.inc(userRequestLabels);
  }

  use(req: FastifyRequest["raw"], res: FastifyReply["raw"], next: () => void) {
    try {
      // Get the request method and path
      const method = req.method || "UNKNOWN";
      const origin = req.url || "/unknown";

      // Extract user ID from JWT token (if present)
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

          // Update user metrics if user ID is available
          if (userId) {
            this.updateUserMetrics(userId, method, statusCode);
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
}
