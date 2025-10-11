# BullMQ Testflow Scheduler Implementation

This implementation migrates the testflow scheduling system from NestJS's in-memory scheduler to BullMQ with Redis for distributed job scheduling.

## Features

- **Distributed Scheduling**: Jobs are stored in Redis, allowing multiple backend instances to share the same job queue
- **No Duplicate Jobs**: BullMQ ensures only one instance of a job runs at a time across all servers  
- **Job Persistence**: Jobs survive server restarts and are retried on failure
- **Cron Support**: Full cron expression support for complex scheduling patterns
- **Monitoring**: BullMQ provides built-in job monitoring and management

## Architecture

### Components

1. **TestflowSchedulerService** (`testflow-scheduler.bullmq.ts`)
   - Manages job scheduling using BullMQ queues
   - Handles repeatable jobs with cron expressions
   - Provides job removal and management methods

2. **TestflowWorkerService** (`testflow-worker.service.ts`)
   - Worker process that executes scheduled testflow jobs
   - Handles job processing and error management
   - Updates execution history in the database

3. **Redis Configuration** (`redis.config.ts`)
   - Shared Redis connection configuration
   - Optimized for BullMQ usage

### Flow

1. **Job Creation**: When a testflow schedule is created/updated, a BullMQ repeatable job is added to the queue
2. **Job Execution**: The worker service processes jobs from the queue and executes testflows
3. **Result Storage**: Execution results are stored in the database with full history tracking

## Environment Variables

```bash
REDIS_URL=redis://localhost:6379  # Redis connection URL (default: redis://localhost:6379)
```

## Benefits over NestJS Scheduler

- **Horizontal Scaling**: Multiple backend instances can run without job duplication
- **Reliability**: Jobs are persisted and won't be lost on server restart
- **Performance**: Redis-based queue is more efficient for high-volume scheduling
- **Monitoring**: Better observability into job status and execution
- **Retry Logic**: Built-in retry mechanisms for failed jobs

## Migration Notes

- The original `testflow-schedular.service.ts` is replaced with `testflow-scheduler.bullmq.ts`
- All scheduling logic now uses BullMQ queues instead of in-memory cron jobs
- Job execution is handled by a dedicated worker service
- Database operations remain unchanged
