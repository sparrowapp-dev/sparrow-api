import { Test, TestingModule } from "@nestjs/testing";
import { UserMetricsService } from "./user-metrics.service";
import { Gauge, Counter } from "prom-client";

describe("UserMetricsService", () => {
  let service: UserMetricsService;
  let uniqueUsersGauge: jest.Mocked<Gauge<string>>;
  let userRequestsCounter: jest.Mocked<Counter<string>>;
  let activeUsersGauge: jest.Mocked<Gauge<string>>;

  beforeEach(async () => {
    // Create mock metrics
    uniqueUsersGauge = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    userRequestsCounter = {
      get: jest.fn(),
      inc: jest.fn(),
    } as any;

    activeUsersGauge = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserMetricsService,
        {
          provide: "PROM_METRIC_unique_users_total",
          useValue: uniqueUsersGauge,
        },
        {
          provide: "PROM_METRIC_user_requests_total",
          useValue: userRequestsCounter,
        },
        {
          provide: "PROM_METRIC_active_users_current",
          useValue: activeUsersGauge,
        },
      ],
    }).compile();

    service = module.get<UserMetricsService>(UserMetricsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getUserMetricsSummary", () => {
    it("should return user metrics summary", async () => {
      // Mock the metric values
      uniqueUsersGauge.get.mockResolvedValue({
        name: "unique_users_total",
        help: "Total number of unique users",
        type: "gauge",
        values: [{ value: 150, labels: { environment: "test" } }],
      } as any);

      activeUsersGauge.get.mockResolvedValue({
        name: "active_users_current",
        help: "Number of currently active users",
        type: "gauge",
        values: [{ value: 25, labels: { environment: "test" } }],
      } as any);

      // Set environment for test
      process.env.APP_ENV = "test";

      const result = await service.getUserMetricsSummary();

      expect(result).toEqual({
        totalUniqueUsers: 150,
        activeUsers: 25,
        environment: "test",
        lastUpdated: expect.any(Date),
      });
    });

    it("should handle missing metrics gracefully", async () => {
      uniqueUsersGauge.get.mockResolvedValue({
        name: "unique_users_total",
        help: "Total number of unique users",
        type: "gauge",
        values: [],
      } as any);

      activeUsersGauge.get.mockResolvedValue({
        name: "active_users_current",
        help: "Number of currently active users",
        type: "gauge",
        values: [],
      } as any);

      process.env.APP_ENV = "test";

      const result = await service.getUserMetricsSummary();

      expect(result).toEqual({
        totalUniqueUsers: 0,
        activeUsers: 0,
        environment: "test",
        lastUpdated: expect.any(Date),
      });
    });
  });

  describe("getUserRequestStats", () => {
    it("should return user request statistics", async () => {
      userRequestsCounter.get.mockResolvedValue({
        name: "user_requests_total",
        help: "Total number of requests per user",
        type: "counter",
        values: [
          { value: 45, labels: { user_id: "user1", method: "GET", status: "200", environment: "test" } },
          { value: 30, labels: { user_id: "user2", method: "POST", status: "201", environment: "test" } },
          { value: 15, labels: { user_id: "user1", method: "POST", status: "200", environment: "test" } },
        ],
      } as any);

      const result = await service.getUserRequestStats();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        userId: "user1",
        totalRequests: 60, // 45 + 15
        lastActivity: expect.any(Date),
      });
      expect(result[1]).toEqual({
        userId: "user2",
        totalRequests: 30,
        lastActivity: expect.any(Date),
      });
    });

    it("should handle numeric user IDs", async () => {
      userRequestsCounter.get.mockResolvedValue({
        name: "user_requests_total",
        help: "Total number of requests per user",
        type: "counter",
        values: [
          { value: 25, labels: { user_id: 123, method: "GET", status: "200", environment: "test" } },
          { value: 35, labels: { user_id: "456", method: "POST", status: "201", environment: "test" } },
        ],
      } as any);

      const result = await service.getUserRequestStats();

      expect(result).toHaveLength(2);
      expect(result.find(u => u.userId === "123")).toEqual({
        userId: "123",
        totalRequests: 25,
        lastActivity: expect.any(Date),
      });
      expect(result.find(u => u.userId === "456")).toEqual({
        userId: "456",
        totalRequests: 35,
        lastActivity: expect.any(Date),
      });
    });
  });

  describe("getTopActiveUsers", () => {
    it("should return top active users sorted by request count", async () => {
      userRequestsCounter.get.mockResolvedValue({
        name: "user_requests_total",
        help: "Total number of requests per user",
        type: "counter",
        values: [
          { value: 45, labels: { user_id: "user1", method: "GET", status: "200", environment: "test" } },
          { value: 100, labels: { user_id: "user2", method: "POST", status: "201", environment: "test" } },
          { value: 75, labels: { user_id: "user3", method: "GET", status: "200", environment: "test" } },
        ],
      } as any);

      const result = await service.getTopActiveUsers(2);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe("user2");
      expect(result[0].totalRequests).toBe(100);
      expect(result[1].userId).toBe("user3");
      expect(result[1].totalRequests).toBe(75);
    });
  });

  describe("resetMetrics", () => {
    it("should reset gauge metrics to 0", async () => {
      process.env.APP_ENV = "test";

      await service.resetMetrics();

      expect(uniqueUsersGauge.set).toHaveBeenCalledWith({ environment: "test" }, 0);
      expect(activeUsersGauge.set).toHaveBeenCalledWith({ environment: "test" }, 0);
    });
  });
});
