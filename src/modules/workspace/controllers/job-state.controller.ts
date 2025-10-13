import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JobStateTracker } from "../services/job-state-tracker.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorators";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";

@ApiTags('Job Monitoring')
@Controller('monitoring/jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin')
@ApiBearerAuth()
export class JobStateController {
  constructor(private readonly jobStateTracker: JobStateTracker) {}

  @Get('current-status')
  @ApiOperation({ summary: 'Get current job queue status' })
  @ApiResponse({ status: 200, description: 'Current job status retrieved successfully' })
  async getCurrentStatus() {
    return await this.jobStateTracker.getCurrentJobStatus();
  }

  @Get('recent-events')
  @ApiOperation({ summary: 'Get recent job state events' })
  @ApiResponse({ status: 200, description: 'Recent job events retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of events to retrieve (default: 50)' })
  async getRecentEvents(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 50;
    return this.jobStateTracker.getRecentEvents(limitNumber);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get job statistics for a time period' })
  @ApiResponse({ status: 200, description: 'Job statistics retrieved successfully' })
  @ApiQuery({ name: 'minutes', required: false, description: 'Time period in minutes (default: 60)' })
  async getStatistics(@Query('minutes') minutes?: string) {
    const minutesBack = minutes ? parseInt(minutes, 10) : 60;
    return this.jobStateTracker.getJobStatistics(minutesBack);
  }

  @Get('job-history/:jobId')
  @ApiOperation({ summary: 'Get complete history for a specific job' })
  @ApiResponse({ status: 200, description: 'Job history retrieved successfully' })
  async getJobHistory(@Query('jobId') jobId: string) {
    return this.jobStateTracker.getJobEvents(jobId);
  }

  @Get('live-summary')
  @ApiOperation({ summary: 'Get live summary of job states' })
  @ApiResponse({ status: 200, description: 'Live summary retrieved successfully' })
  async getLiveSummary() {
    const [currentStatus, recentStats, recentEvents] = await Promise.all([
      this.jobStateTracker.getCurrentJobStatus(),
      this.jobStateTracker.getJobStatistics(5), // Last 5 minutes
      this.jobStateTracker.getRecentEvents(10)   // Last 10 events
    ]);

    return {
      timestamp: new Date(),
      current: currentStatus.counts,
      performance: recentStats.performance,
      recentActivity: recentEvents.map(event => ({
        jobId: event.jobId,
        state: event.state,
        timestamp: event.timestamp,
        duration: event.duration,
        error: event.error,
      })),
      health: {
        status: recentStats.performance.successRate >= 90 ? 'healthy' : 
               recentStats.performance.successRate >= 70 ? 'warning' : 'critical',
        successRate: recentStats.performance.successRate,
        averageProcessingTime: recentStats.performance.averageDuration,
      }
    };
  }
}
