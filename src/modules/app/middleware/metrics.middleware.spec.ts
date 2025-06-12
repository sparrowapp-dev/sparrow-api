import { Test, TestingModule } from "@nestjs/testing";
import { CustomMetricsMiddleware } from "./metrics.middleware";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Counter, Gauge } from "prom-client";
import { FastifyRequest, FastifyReply } from "fastify";

describe("CustomMetricsMiddleware", () => {
  let middleware: CustomMetricsMiddleware;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let mockCounters: { [key: string]: jest.Mocked<Counter<string>> };
  let mockGauges: { [key: string]: jest.Mocked<Gauge<string>> };

  beforeEach(async () => {
    // Create mock metrics
    mockCounters = {
      count: { inc: jest.fn() } as any,
      user_requests_total: { inc: jest.fn() } as any,
    };

    mockGauges = {
      gauge: { inc: jest.fn(), dec: jest.fn(), set: jest.fn() } as any,
      app_duration_metrics: { set: jest.fn() } as any,
      unique_users_total: { set: jest.fn() } as any,
      active_users_current: { set: jest.fn() } as any,
    };

    jwtService = {
      verify: jest.fn(),
    } as any;

    configService = {
      get: jest.fn().mockReturnValue("test-secret"),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomMetricsMiddleware,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: "PROM_METRIC_count", useValue: mockCounters.count },
        { provide: "PROM_METRIC_gauge", useValue: mockGauges.gauge },
        { provide: "PROM_METRIC_app_duration_metrics", useValue: mockGauges.app_duration_metrics },
        { provide: "PROM_METRIC_unique_users_total", useValue: mockGauges.unique_users_total },
        { provide: "PROM_METRIC_user_requests_total", useValue: mockCounters.user_requests_total },
        { provide: "PROM_METRIC_active_users_current", useValue: mockGauges.active_users_current },
      ],
    }).compile();

    middleware = module.get<CustomMetricsMiddleware>(CustomMetricsMiddleware);
  });

  it("should be defined", () => {
    expect(middleware).toBeDefined();
  });

  describe("extractUserIdFromRequest", () => {
    it("should extract user ID from valid JWT token", () => {
      const mockRequest = {
        headers: {
          authorization: "Bearer valid-token",
        },
      } as FastifyRequest["raw"];

      jwtService.verify.mockReturnValue({ _id: "user123", exp: Date.now() / 1000 + 3600 });

      const userId = (middleware as any).extractUserIdFromRequest(mockRequest);

      expect(userId).toBe("user123");
      expect(jwtService.verify).toHaveBeenCalledWith("valid-token", {
        secret: "test-secret",
      });
    });

    it("should return null for invalid token", () => {
      const mockRequest = {
        headers: {
          authorization: "Bearer invalid-token",
        },
      } as FastifyRequest["raw"];

      jwtService.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const userId = (middleware as any).extractUserIdFromRequest(mockRequest);

      expect(userId).toBeNull();
    });

    it("should return null when no authorization header", () => {
      const mockRequest = {
        headers: {},
      } as FastifyRequest["raw"];

      const userId = (middleware as any).extractUserIdFromRequest(mockRequest);

      expect(userId).toBeNull();
    });

    it("should return null for malformed authorization header", () => {
      const mockRequest = {
        headers: {
          authorization: "InvalidFormat token",
        },
      } as FastifyRequest["raw"];

      const userId = (middleware as any).extractUserIdFromRequest(mockRequest);

      expect(userId).toBeNull();
    });
  });

  describe("updateUserMetrics", () => {
    beforeEach(() => {
      process.env.APP_ENV = "test";
    });

    it("should update user metrics for new user", () => {
      const userId = "user123";
      const method = "GET";
      const statusCode = 200;

      (middleware as any).updateUserMetrics(userId, method, statusCode);

      expect(mockGauges.unique_users_total.set).toHaveBeenCalledWith(
        { environment: "test" },
        1
      );
      expect(mockGauges.active_users_current.set).toHaveBeenCalled();
      expect(mockCounters.user_requests_total.inc).toHaveBeenCalledWith({
        user_id: userId,
        method,
        status: statusCode.toString(),
        environment: "test",
      });
    });

    it("should not increment unique users count for existing user", () => {
      const userId = "user123";
      const method = "GET";
      const statusCode = 200;

      // First request
      (middleware as any).updateUserMetrics(userId, method, statusCode);
      
      // Reset mock calls
      jest.clearAllMocks();
      
      // Second request from same user
      (middleware as any).updateUserMetrics(userId, method, statusCode);

      // Unique users should not be incremented again
      expect(mockGauges.unique_users_total.set).not.toHaveBeenCalled();
      
      // But user requests should still be tracked
      expect(mockCounters.user_requests_total.inc).toHaveBeenCalledWith({
        user_id: userId,
        method,
        status: statusCode.toString(),
        environment: "test",
      });
    });
  });

  describe("cleanupInactiveUsers", () => {
    beforeEach(() => {
      process.env.APP_ENV = "test";
    });

    it("should remove inactive users", () => {
      // Add some users to active users map
      const activeUsers = (middleware as any).activeUsers;
      const now = Date.now();
      const timeout = (middleware as any).ACTIVE_USER_TIMEOUT;
      
      activeUsers.set("user1", now - timeout - 1000); // Inactive
      activeUsers.set("user2", now - 1000); // Active

      (middleware as any).cleanupInactiveUsers();

      expect(activeUsers.has("user1")).toBe(false);
      expect(activeUsers.has("user2")).toBe(true);
      expect(mockGauges.active_users_current.set).toHaveBeenCalledWith(
        { environment: "test" },
        1
      );
    });
  });
});
