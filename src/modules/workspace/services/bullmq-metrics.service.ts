import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface JobMetrics {
  jobId: string;
  jobName: string;
  status: 'started' | 'completed' | 'failed' | 'stalled' | 'delayed';
  duration?: number;
  errorMessage?: string;
  attemptsMade?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class BullMQMetricsService {
  private readonly logger = new Logger(BullMQMetricsService.name);
  private metrics: JobMetrics[] = [];
  private readonly maxMetricsHistory = 1000; // Keep last 1000 job metrics

  // Counters
  private counters = {
    jobsStarted: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    jobsStalled: 0,
    totalProcessingTime: 0,
  };

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Record job start
   */
  recordJobStart(jobId: string, jobName: string, metadata?: Record<string, any>) {
    const metric: JobMetrics = {
      jobId,
      jobName,
      status: 'started',
      timestamp: new Date(),
      metadata,
    };

    this.addMetric(metric);
    this.counters.jobsStarted++;
    
    this.eventEmitter.emit('job.started', metric);
    this.logger.debug(`Job started: ${jobId} (${jobName})`);
  }

  /**
   * Record job completion
   */
  recordJobCompletion(
    jobId: string, 
    jobName: string, 
    duration: number, 
    metadata?: Record<string, any>
  ) {
    const metric: JobMetrics = {
      jobId,
      jobName,
      status: 'completed',
      duration,
      timestamp: new Date(),
      metadata,
    };

    this.addMetric(metric);
    this.counters.jobsCompleted++;
    this.counters.totalProcessingTime += duration;
    
    this.eventEmitter.emit('job.completed', metric);
    this.logger.log(`Job completed: ${jobId} (${jobName}) in ${duration}ms`);
  }

  /**
   * Record job failure
   */
  recordJobFailure(
    jobId: string, 
    jobName: string, 
    error: string, 
    attemptsMade: number, 
    metadata?: Record<string, any>
  ) {
    const metric: JobMetrics = {
      jobId,
      jobName,
      status: 'failed',
      errorMessage: error,
      attemptsMade,
      timestamp: new Date(),
      metadata,
    };

    this.addMetric(metric);
    this.counters.jobsFailed++;
    
    this.eventEmitter.emit('job.failed', metric);
    this.logger.error(`Job failed: ${jobId} (${jobName}) - ${error}`);
  }

  /**
   * Record job stall
   */
  recordJobStall(jobId: string, jobName: string, metadata?: Record<string, any>) {
    const metric: JobMetrics = {
      jobId,
      jobName,
      status: 'stalled',
      timestamp: new Date(),
      metadata,
    };

    this.addMetric(metric);
    this.counters.jobsStalled++;
    
    this.eventEmitter.emit('job.stalled', metric);
    this.logger.warn(`Job stalled: ${jobId} (${jobName})`);
  }

  private addMetric(metric: JobMetrics) {
    this.metrics.push(metric);
    
    // Keep only the latest metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Get comprehensive metrics for the last period
   */
  getMetrics(periodMinutes: number = 60): any {
    const cutoffTime = new Date(Date.now() - (periodMinutes * 60 * 1000));
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);

    const stats = {
      period: `${periodMinutes} minutes`,
      timestamp: new Date(),
      jobCounts: {
        started: recentMetrics.filter(m => m.status === 'started').length,
        completed: recentMetrics.filter(m => m.status === 'completed').length,
        failed: recentMetrics.filter(m => m.status === 'failed').length,
        stalled: recentMetrics.filter(m => m.status === 'stalled').length,
      },
      performance: this.calculatePerformanceMetrics(recentMetrics),
      errorAnalysis: this.analyzeErrors(recentMetrics),
      totalCounters: { ...this.counters },
    };

    return stats;
  }

  private calculatePerformanceMetrics(metrics: JobMetrics[]) {
    const completedJobs = metrics.filter(m => m.status === 'completed' && m.duration);
    
    if (completedJobs.length === 0) {
      return {
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        throughput: 0,
      };
    }

    const durations = completedJobs.map(m => m.duration!);
    const sum = durations.reduce((a, b) => a + b, 0);
    
    return {
      averageDuration: Math.round(sum / durations.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      throughput: completedJobs.length, // jobs per period
      successRate: ((completedJobs.length / Math.max(metrics.length, 1)) * 100).toFixed(2) + '%',
    };
  }

  private analyzeErrors(metrics: JobMetrics[]) {
    const failedJobs = metrics.filter(m => m.status === 'failed');
    
    const errorTypes: Record<string, number> = {};
    const jobTypes: Record<string, number> = {};
    
    failedJobs.forEach(job => {
      if (job.errorMessage) {
        const errorType = this.categorizeError(job.errorMessage);
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      }
      
      jobTypes[job.jobName] = (jobTypes[job.jobName] || 0) + 1;
    });

    return {
      totalFailures: failedJobs.length,
      errorTypes,
      failedJobTypes: jobTypes,
      recentFailures: failedJobs.slice(-5).map(job => ({
        jobId: job.jobId,
        jobName: job.jobName,
        error: job.errorMessage,
        timestamp: job.timestamp,
      })),
    };
  }

  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      return 'timeout';
    }
    if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
      return 'connection';
    }
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      return 'authentication';
    }
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return 'validation';
    }
    return 'unknown';
  }

  /**
   * Reset all counters and metrics (for testing or maintenance)
   */
  reset() {
    this.metrics = [];
    this.counters = {
      jobsStarted: 0,
      jobsCompleted: 0,
      jobsFailed: 0,
      jobsStalled: 0,
      totalProcessingTime: 0,
    };
    
    this.logger.log('Metrics reset');
  }

  /**
   * Get real-time statistics
   */
  getRealtimeStats() {
    const last5Minutes = this.getMetrics(5);
    const last60Minutes = this.getMetrics(60);

    return {
      current: {
        queueHealth: this.calculateQueueHealth(),
        activeJobs: this.metrics.filter(m => 
          m.status === 'started' && 
          !this.metrics.some(cm => 
            cm.jobId === m.jobId && 
            cm.timestamp > m.timestamp && 
            ['completed', 'failed'].includes(cm.status)
          )
        ).length,
      },
      last5Minutes,
      lastHour: last60Minutes,
    };
  }

  private calculateQueueHealth(): 'healthy' | 'warning' | 'critical' {
    const recentMetrics = this.metrics.filter(m => 
      m.timestamp >= new Date(Date.now() - (5 * 60 * 1000)) // Last 5 minutes
    );

    const failureRate = recentMetrics.filter(m => m.status === 'failed').length / Math.max(recentMetrics.length, 1);
    
    if (failureRate > 0.5) return 'critical';
    if (failureRate > 0.2) return 'warning';
    return 'healthy';
  }
}
