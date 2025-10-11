import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BullMQMonitoringConfig {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if monitoring dashboard should be enabled
   * Only enable in development or when explicitly enabled in production
   */
  get isDashboardEnabled(): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const explicitlyEnabled = this.configService.get<string>('BULLMQ_DASHBOARD_ENABLED', 'false') === 'true';
    
    return nodeEnv === 'development' || explicitlyEnabled;
  }

  /**
   * Get dashboard base path
   */
  get dashboardPath(): string {
    return this.configService.get<string>('BULLMQ_DASHBOARD_PATH', '/admin/queues');
  }

  /**
   * Get cleanup job settings
   */
  get cleanupSettings() {
    return {
      // Keep completed jobs for 24 hours by default
      completedMaxAge: parseInt(this.configService.get<string>('BULLMQ_COMPLETED_MAX_AGE', '86400000'), 10),
      // Keep failed jobs for 48 hours by default  
      failedMaxAge: parseInt(this.configService.get<string>('BULLMQ_FAILED_MAX_AGE', '172800000'), 10),
      // Maximum number of jobs to clean in one operation
      cleanupBatchSize: parseInt(this.configService.get<string>('BULLMQ_CLEANUP_BATCH_SIZE', '100'), 10),
    };
  }

  /**
   * Get monitoring alert thresholds
   */
  get alertThresholds() {
    return {
      // Alert if more than this many jobs fail
      maxFailedJobs: parseInt(this.configService.get<string>('BULLMQ_MAX_FAILED_JOBS', '10'), 10),
      // Alert if jobs are waiting longer than this (milliseconds)
      maxWaitingTime: parseInt(this.configService.get<string>('BULLMQ_MAX_WAITING_TIME', '300000'), 10), // 5 minutes
      // Alert if success rate drops below this percentage
      minSuccessRate: parseInt(this.configService.get<string>('BULLMQ_MIN_SUCCESS_RATE', '95'), 10),
    };
  }
}
