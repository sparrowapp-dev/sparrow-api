import { Test, TestingModule } from "@nestjs/testing";
import { UserMetricsService } from "../services/user-metrics.service";
import { UserMetricsRepository } from "../repositories/user-metrics.repository";
import { Counter, Gauge } from "prom-client";

describe("UserMetricsService", () => {
  let service: UserMetricsService;
  let repository: UserMetricsRepository;
  let mockUniqueUsersGauge: jest.Mocked<Gauge<string>>;
  let mockUserRequestsCounter: jest.Mocked<Counter<string>>;
  let mockActiveUsersGauge: jest.Mocked<Gauge<string>>;

  beforeEach(async () => {
    // Create mock Prometheus metrics
    mockUniqueUsersGauge = {
      set: jest.fn(),
      inc: jest.fn(),
      dec: jest.fn(),
      get: jest.fn(),
      reset: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      labels: jest.fn(),
    } as any;

    mockUserRequestsCounter = {
      inc: jest.fn(),
      get: jest.fn(),
      reset: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      labels: jest.fn(),
    } as any;

    mockActiveUsersGauge = {
      set: jest.fn(),
      inc: jest.fn(),
      dec: jest.fn(),
      get: jest.fn(),
      reset: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      labels: jest.fn(),
    } as any;

    // Create mock repository
    const mockRepository = {
      upsertUserActivity: jest.fn(),
      getUniqueUserCount: jest.fn(),
      getActiveUserCount: jest.fn(),
      getUserRequestCount: jest.fn(),
      getUserActivityStats: jest.fn(),
      cleanupOldRecords: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserMetricsService,
        {
          provide: UserMetricsRepository,
          useValue: mockRepository,
        },
        {
          provide: "unique_users_total",
          useValue: mockUniqueUsersGauge,
        },
        {
          provide: "user_requests_total",
          useValue: mockUserRequestsCounter,
        },
        {
          provide: "active_users_current",
          useValue: mockActiveUsersGauge,
        },
      ],
    }).compile();

    service = module.get<UserMetricsService>(UserMetricsService);
    repository = module.get<UserMetricsRepository>(UserMetricsRepository);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("trackUserActivity", () => {
    it("should track user activity successfully", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const requestDetails = {
        method: "GET",
        origin: "/api/test",
        status: "200",
      };

      jest.spyOn(repository, "upsertUserActivity").mockResolvedValue();

      await service.trackUserActivity(userId, requestDetails);

      expect(repository.upsertUserActivity).toHaveBeenCalledWith(
        userId,
        process.env.APP_ENV || "development",
      );
      expect(mockUserRequestsCounter.inc).toHaveBeenCalledWith({
        user_id: userId,
        method: "GET",
        origin: "/api/test",
        status: "200",
        environment: process.env.APP_ENV || "development",
      });
    });

    it("should handle errors gracefully", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const requestDetails = { method: "GET" };

      jest
        .spyOn(repository, "upsertUserActivity")
        .mockRejectedValue(new Error("Database error"));

      // Should not throw
      await expect(
        service.trackUserActivity(userId, requestDetails),
      ).resolves.toBeUndefined();
    });
  });

  describe("getUniqueUserCount", () => {
    it("should return unique user count", async () => {
      const expectedCount = 42;
      jest
        .spyOn(repository, "getUniqueUserCount")
        .mockResolvedValue(expectedCount);

      const result = await service.getUniqueUserCount();

      expect(result).toBe(expectedCount);
      expect(repository.getUniqueUserCount).toHaveBeenCalledWith(
        process.env.APP_ENV || "development",
      );
    });

    it("should return 0 on error", async () => {
      jest
        .spyOn(repository, "getUniqueUserCount")
        .mockRejectedValue(new Error("Database error"));

      const result = await service.getUniqueUserCount();

      expect(result).toBe(0);
    });
  });

  describe("getUserStatistics", () => {
    it("should return comprehensive user statistics", async () => {
      const mockStats = {
        totalUsers: 100,
        totalRequests: 1000,
        averageRequestsPerUser: 10,
      };

      jest.spyOn(repository, "getUniqueUserCount").mockResolvedValue(100);
      jest
        .spyOn(repository, "getActiveUserCount")
        .mockResolvedValueOnce(80) // 24h
        .mockResolvedValueOnce(90) // 7d
        .mockResolvedValueOnce(95); // 30d
      jest
        .spyOn(repository, "getUserActivityStats")
        .mockResolvedValue(mockStats);

      const result = await service.getUserStatistics();

      expect(result).toEqual({
        uniqueUsers: 100,
        activeUsers24h: 80,
        activeUsers7d: 90,
        activeUsers30d: 95,
        totalRequests: 1000,
        averageRequestsPerUser: 10,
      });
    });
  });
});
