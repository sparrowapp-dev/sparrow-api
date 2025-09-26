import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import axios from "axios";
import { TestflowRepository } from "../repositories/testflow.repository";
import { EnvironmentRepository } from "../repositories/environment.repository";
import { DecodedUserObject } from "@src/types/fastify";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TestflowRunService {
  constructor(
    private readonly testflowRepository: TestflowRepository,
    private readonly environmentReposistory: EnvironmentRepository,
    private readonly configService: ConfigService,
  ) {}
  private readonly logger = new Logger(TestflowRunService.name);

  public handleTestFlowRun = async (
    testflowId: string,
    environmentId: string,
    user: DecodedUserObject,
  ): Promise<any> => {
    // Fetch testflow and environment data
    const testflowData = await this.testflowRepository.get(testflowId);
    if (!testflowData) {
      throw new NotFoundException("Testflow not found.");
    }
    const environmentData =
      await this.environmentReposistory.get(environmentId);
    if (!environmentData) {
      throw new NotFoundException("Environment not found.");
    }
    // Build proxy URL
    const sparrowProxy = this.configService.get<string>("sparrowProxy.baseUrl");
    const proxyUrl = `${sparrowProxy}/proxy/testflow/execute`;
    // Prepare request body for proxy API
    const body = {
      nodes: testflowData.nodes || [],
      variables: environmentData.variable || [],
      edges:testflowData.edges,
      userId: user._id,
    };
    try {
      const response = await axios.post(proxyUrl, body, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      // Return only history or any relevant part
      return response.data;
    } catch (error: any) {
      console.error("Testflow proxy execution failed:", error.message || error);
      throw new Error(error?.message || "Testflow execution failed.");
    }
  };
}