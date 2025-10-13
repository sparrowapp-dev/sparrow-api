import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator implements OnModuleInit {
  private readonly logger = new Logger(RedisHealthIndicator.name);
  private redis: Redis;
  private circuitBreakerFailures = 0;
  private circuitBreakerLastFailure = 0;
  private readonly maxFailures = 5;
  private readonly timeoutMs = 30000; // 30 seconds

  constructor(private readonly configService: ConfigService) {
    super();
  }

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl, {
      connectTimeout: 5000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
      this.circuitBreakerFailures++;
      this.circuitBreakerLastFailure = Date.now();
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
      this.circuitBreakerFailures = 0;
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        throw new Error('Circuit breaker is open - Redis unavailable');
      }

      const startTime = Date.now();
      
      // Test Redis connectivity with timeout
      const pingResult = await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis ping timeout')), 5000)
        )
      ]);

      const responseTime = Date.now() - startTime;

      if (pingResult === 'PONG') {
        const result = this.getStatus(key, true, {
          status: 'up',
          responseTime: `${responseTime}ms`,
          connection: 'established',
          circuitBreaker: 'closed'
        });
        
        // Reset circuit breaker on success
        this.circuitBreakerFailures = 0;
        return result;
      }

      throw new Error('Invalid Redis ping response');
      
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error.message}`);
      
      this.circuitBreakerFailures++;
      this.circuitBreakerLastFailure = Date.now();

      const result = this.getStatus(key, false, {
        status: 'down',
        error: error.message,
        circuitBreaker: this.isCircuitBreakerOpen() ? 'open' : 'closed',
        failures: this.circuitBreakerFailures
      });

      throw new HealthCheckError('Redis check failed', result);
    }
  }

  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerFailures >= this.maxFailures) {
      const timeSinceLastFailure = Date.now() - this.circuitBreakerLastFailure;
      return timeSinceLastFailure < this.timeoutMs;
    }
    return false;
  }

  async getRedisInfo(): Promise<any> {
    try {
      if (this.isCircuitBreakerOpen()) {
        return { status: 'circuit_breaker_open', failures: this.circuitBreakerFailures };
      }

      const info = await this.redis.info();
      const memory = await this.redis.info('memory');
      const stats = await this.redis.info('stats');
      
      return {
        status: 'connected',
        info: {
          server: this.parseRedisInfo(info, 'Server'),
          memory: this.parseRedisInfo(memory, 'Memory'),
          stats: this.parseRedisInfo(stats, 'Stats'),
        }
      };
    } catch (error) {
      this.logger.error('Failed to get Redis info:', error);
      return { status: 'error', error: error.message };
    }
  }

  private parseRedisInfo(info: string, section: string): Record<string, string> {
    const lines = info.split('\r\n');
    const result: Record<string, string> = {};
    
    let inSection = false;
    for (const line of lines) {
      if (line.startsWith(`# ${section}`)) {
        inSection = true;
        continue;
      }
      if (line.startsWith('#')) {
        inSection = false;
        continue;
      }
      if (inSection && line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }
}
