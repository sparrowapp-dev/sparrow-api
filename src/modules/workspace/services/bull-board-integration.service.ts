import { Injectable, OnApplicationBootstrap, Logger } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { FastifyInstance } from "fastify";
import { BullMQMonitoringService } from "./bullmq-monitoring.service";

@Injectable()
export class BullBoardIntegrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BullBoardIntegrationService.name);

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly monitoringService: BullMQMonitoringService,
  ) {}

  onApplicationBootstrap() {
    const httpAdapter = this.adapterHost.httpAdapter;
    
    if (httpAdapter?.getType() === 'fastify') {
      const fastifyInstance: FastifyInstance = httpAdapter.getInstance();
      this.setupBullBoardRoute(fastifyInstance);
    } else {
      this.logger.warn('Bull Board integration requires Fastify adapter');
    }
  }

  private setupBullBoardRoute(fastifyInstance: FastifyInstance) {
    try {
      const serverAdapter = this.monitoringService.getServerAdapter();
      
      // Register Bull Board UI routes
      fastifyInstance.register(serverAdapter.registerPlugin(), {
        prefix: '/admin/queues',
      });

      this.logger.log('Bull Board dashboard registered at /admin/queues');
    } catch (error) {
      this.logger.error('Failed to setup Bull Board route:', error);
    }
  }
}
