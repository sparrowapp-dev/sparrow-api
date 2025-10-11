import { Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { BullMQMonitoringService } from "../services/bullmq-monitoring.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorators";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags('Monitoring')
@Controller('monitoring/bullmq')
@Roles('super-admin')
@ApiBearerAuth()
export class BullMQMonitoringController {
  constructor(private readonly monitoringService: BullMQMonitoringService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get queue metrics and statistics' })
  @ApiResponse({ status: 200, description: 'Queue metrics retrieved successfully' })
  async getQueueMetrics() {
    return await this.monitoringService.getQueueMetrics();
  }

  @Get('failed-jobs')
  @ApiOperation({ summary: 'Get failed jobs with details' })
  @ApiResponse({ status: 200, description: 'Failed jobs retrieved successfully' })
  async getFailedJobs(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return await this.monitoringService.getFailedJobsDetails(limitNumber);
  }

  @Post('cleanup')
  @ApiOperation({ summary: 'Clean up old completed and failed jobs' })
  @ApiResponse({ status: 200, description: 'Cleanup completed successfully' })
  async cleanupOldJobs() {
    return await this.monitoringService.cleanupOldJobs();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get queue health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  async getHealthStatus() {
    const metrics = await this.monitoringService.getQueueMetrics();
    return {
      status: metrics.health.isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      details: metrics.health,
      summary: metrics.summary,
    };
  }
}
