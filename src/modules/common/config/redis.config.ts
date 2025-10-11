import IORedis from "ioredis";

// Create a shared Redis connection instance for BullMQ
export const createRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  
  try {
    return new IORedis(redisUrl, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true, // Don't connect immediately
    });
  } catch (error) {
    console.error('Redis connection failed:', error.message);
    throw error;
  }
};
