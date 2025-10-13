import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { TestflowSchedulerService } from "./testflow-scheduler.bullmq";
import { TestflowWorkerService } from "./testflow-worker.service";

export interface JobStateEvent {
  jobId: string;
  jobName: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'stalled';
  timestamp: Date;
  data?: any;
  error?: string;
  duration?: number;
}

@Injectable()
export class JobStateTracker implements OnModuleInit {
  private readonly logger = new Logger(JobStateTracker.name);
  private jobEvents: JobStateEvent[] = [];
  private readonly maxEvents = 500; // Keep last 500 events

  constructor(
    private readonly schedulerService: TestflowSchedulerService,
    private readonly workerService: TestflowWorkerService,
  ) {}

  onModuleInit() {
    this.setupJobEventListeners();
    this.logger.log('Job State Tracker initialized');
  }

  private setupJobEventListeners() {
    const queue = this.schedulerService.queue;
    const worker = this.workerService.getWorker();

    // Queue events
    queue.on('waiting', (job) => {
      this.trackJobEvent({
        jobId: job.id,
        jobName: job.name,
        state: 'waiting',
        timestamp: new Date(),
        data: job.data,
      });
    });

    // Worker events (these give us better lifecycle tracking)
    if (worker) {
      worker.on('active', (job) => {
        this.trackJobEvent({
          jobId: job.id,
          jobName: job.name,
          state: 'active',
          timestamp: new Date(),
          data: job.data,
        });
      });

      worker.on('completed', (job, result) => {
        const startEvent = this.findJobEvent(job.id, 'active');
        const duration = startEvent ? Date.now() - startEvent.timestamp.getTime() : undefined;

        this.trackJobEvent({
          jobId: job.id,
          jobName: job.name,
          state: 'completed',
          timestamp: new Date(),
          data: job.data,
          duration,
        });
      });

      worker.on('failed', (job, error) => {
        const startEvent = this.findJobEvent(job.id, 'active');
        const duration = startEvent ? Date.now() - startEvent.timestamp.getTime() : undefined;

        this.trackJobEvent({
          jobId: job.id,
          jobName: job.name,
          state: 'failed',
          timestamp: new Date(),
          data: job.data,
          error: error.message,
          duration,
        });
      });

      worker.on('stalled', (jobId: string) => {
        this.trackJobEvent({
          jobId: jobId,
          jobName: 'testflow-execution',
          state: 'stalled',
          timestamp: new Date(),
        });
      });
    }
  }

  private trackJobEvent(event: JobStateEvent) {
    // Log the event
    const logMessage = `Job ${event.jobId} (${event.jobName}) -> ${event.state.toUpperCase()}`;
    const logDetails = {
      jobId: event.jobId,
      jobName: event.jobName,
      state: event.state,
      duration: event.duration ? `${event.duration}ms` : undefined,
      error: event.error,
    };

    switch (event.state) {
      case 'waiting':
        this.logger.log(`${logMessage}`, logDetails);
        break;
      case 'active':
        this.logger.log(`${logMessage} - Processing started`, logDetails);
        break;
      case 'completed':
        this.logger.log(`${logMessage} - Success ${event.duration ? `in ${event.duration}ms` : ''}`, logDetails);
        break;
      case 'failed':
        this.logger.error(`${logMessage} - ${event.error}`, logDetails);
        break;
      case 'stalled':
        this.logger.warn(`${logMessage} - Job stalled, will retry`, logDetails);
        break;
      default:
        this.logger.debug(logMessage, logDetails);
    }

    // Store event for tracking
    this.jobEvents.push(event);

    // Keep only recent events to prevent memory leaks
    if (this.jobEvents.length > this.maxEvents) {
      this.jobEvents = this.jobEvents.slice(-this.maxEvents);
    }
  }

  private findJobEvent(jobId: string, state: string): JobStateEvent | undefined {
    return this.jobEvents
      .reverse()
      .find(event => event.jobId === jobId && event.state === state);
  }

  /**
   * Get recent job events
   */
  getRecentEvents(limit: number = 50): JobStateEvent[] {
    return this.jobEvents.slice(-limit).reverse();
  }

  /**
   * Get events for a specific job
   */
  getJobEvents(jobId: string): JobStateEvent[] {
    return this.jobEvents
      .filter(event => event.jobId === jobId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get current job status summary
   */
  async getCurrentJobStatus() {
    const queue = this.schedulerService.queue;
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      timestamp: new Date(),
      counts: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      },
      jobs: {
        waiting: waiting.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          addedAt: new Date(job.timestamp),
        })),
        active: active.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          startedAt: new Date(job.processedOn || job.timestamp),
        })),
        recent_failed: failed.slice(0, 5).map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          error: job.failedReason,
          failedAt: new Date(job.timestamp),
        })),
      }
    };
  }

  /**
   * Get job statistics for the last period
   */
  getJobStatistics(minutesBack: number = 60) {
    const cutoff = new Date(Date.now() - (minutesBack * 60 * 1000));
    const recentEvents = this.jobEvents.filter(event => event.timestamp >= cutoff);

    const stats = {
      period: `Last ${minutesBack} minutes`,
      timestamp: new Date(),
      events: {
        waiting: recentEvents.filter(e => e.state === 'waiting').length,
        active: recentEvents.filter(e => e.state === 'active').length,
        completed: recentEvents.filter(e => e.state === 'completed').length,
        failed: recentEvents.filter(e => e.state === 'failed').length,
        stalled: recentEvents.filter(e => e.state === 'stalled').length,
      },
      performance: this.calculatePerformanceStats(recentEvents),
      recentFailures: recentEvents
        .filter(e => e.state === 'failed')
        .slice(-5)
        .map(e => ({
          jobId: e.jobId,
          jobName: e.jobName,
          error: e.error,
          timestamp: e.timestamp,
        })),
    };

    return stats;
  }

  private calculatePerformanceStats(events: JobStateEvent[]) {
    const completedEvents = events.filter(e => e.state === 'completed' && e.duration);
    
    if (completedEvents.length === 0) {
      return {
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
      };
    }

    const durations = completedEvents.map(e => e.duration!);
    const totalJobs = events.filter(e => ['completed', 'failed'].includes(e.state)).length;
    
    return {
      averageDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: totalJobs > 0 ? Math.round((completedEvents.length / totalJobs) * 100) : 0,
    };
  }

  /**
   * Clear all stored events (for maintenance)
   */
  clearEvents() {
    this.jobEvents = [];
    this.logger.log('Job events cleared');
  }
}
