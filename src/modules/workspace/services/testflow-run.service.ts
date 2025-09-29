import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import axios from "axios";
import { TestflowRepository } from "../repositories/testflow.repository";
import { EnvironmentRepository } from "../repositories/environment.repository";
import { DecodedUserObject } from "@src/types/fastify";
import { ConfigService } from "@nestjs/config";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import { VariableDto } from "@src/modules/common/models/environment.model";
import { ObjectId } from "mongodb";
import { TestflowEdges, TestflowNodes } from "@src/modules/common/models/testflow.model";

@Injectable()
export class TestflowRunService {
  constructor(
    private readonly testflowRepository: TestflowRepository,
    private readonly environmentReposistory: EnvironmentRepository,
    private readonly configService: ConfigService,
    private readonly workspaceReposistory: WorkspaceRepository,
  ) {}
  private readonly logger = new Logger(TestflowRunService.name);

  /**
   * Combines global environment variables with current environment variables
   * Current environment variables take precedence over global ones
   * @param globalVariables - Global environment variables array
   * @param currentVariables - Current environment variables array
   * @returns Combined environment variables.
   */
  private combineEnvironmentData(
    globalVariables: VariableDto[],
    currentVariables: VariableDto[],
  ): VariableDto[] {
    const combined: Array<{ key: string; value: string; checked: boolean; type: "G" | "E" }> = [];

    // Add global environment variables first
    if (globalVariables?.length) {
      globalVariables.forEach((variable) => {
        if (variable.key && variable.checked) {
          combined.push({
            key: variable.key,
            value: variable.value,
            checked: variable.checked,
            type: "G",
          });
        }
      });
    }

    // Add current environment variables (these should override)
    if (currentVariables?.length) {
      currentVariables.forEach((variable) => {
        if (variable.key && variable.checked) {
          combined.push({
            key: variable.key,
            value: variable.value,
            checked:variable.checked,
            type: "E",
          });
        }
      });
    }
    // Deduplicate by key, keeping the last (so current overrides global)
    const deduped = combined.filter(
      (item, index, self) =>
        index === self.findLastIndex((v) => v.key === item.key),
    );
    return deduped.map(({ type, ...rest }) => rest);
  }

  public handleTestFlowRun = async (
    environmentId: string,
    workspaceId: string,
    testflowNodes:TestflowNodes[],
    testflowEdges:TestflowEdges[],
    user?: DecodedUserObject,
  ): Promise<any> => {
    // Fetch testflow and environment data
    const workspaceID = await this.workspaceReposistory.get(workspaceId);
    const globalEnvironment = workspaceID.environments[0];
    const globalEnvDetails = await this.environmentReposistory.get(
      globalEnvironment.id.toString(),
    );
    let environmentData;
    if (environmentId) {
      environmentData =
        await this.environmentReposistory.get(environmentId);
    }
    const activeVariables = this.combineEnvironmentData(
      globalEnvDetails?.variable || [],
      environmentData?.variable || [],
    );
    // Build proxy URL
    const sparrowProxy = this.configService.get<string>("sparrowProxy.baseUrl");
    const proxyUrl = `${sparrowProxy}/proxy/testflow/execute`;
    // Prepare request body for proxy API
    const body = {
      nodes: testflowNodes || [],
      variables: activeVariables || [],
      edges: testflowEdges,
      userId: user?._id || new ObjectId("000000000000000000000000"),
    };
    try {
      const response = await axios.post(proxyUrl, body, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      const finalResult = {
        result:response.data,
        environmentName:environmentData.name
      }
      // Return only history or any relevant part
      return finalResult;
    } catch (error: any) {
      console.error("Testflow proxy execution failed:", error.message || error);
      throw new Error(error?.message || "Testflow execution failed.");
    }
  };
}