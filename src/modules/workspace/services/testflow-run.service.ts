import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import axios from "axios";
import { TestflowRepository } from "../repositories/testflow.repository";
import { EnvironmentRepository } from "../repositories/environment.repository";
import { DecodedUserObject } from "@src/types/fastify";
import { ConfigService } from "@nestjs/config";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import { VariableDto } from "@src/modules/common/models/environment.model";
import { ObjectId } from "mongodb";
import {
  DataSetGroup,
  TestflowDataSet,
  TestflowEdges,
  TestflowNodes,
} from "@src/modules/common/models/testflow.model";
import { BodyModeEnum } from "@src/modules/common/models/collection.model";
import { AddTo } from "../payloads/collection.payload";

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
    const combined: Array<{
      key: string;
      value: string;
      checked: boolean;
      type: "G" | "E";
    }> = [];

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
            checked: variable.checked,
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
    testflowId: string,
    user?: DecodedUserObject,
  ): Promise<any> => {
    try {
      // Fetch testflow and environment data
      const testflowDetails = await this.testflowRepository.get(testflowId);
      const workspaceID = await this.workspaceReposistory.get(workspaceId);
      const globalEnvironment = workspaceID.environments[0];
      const globalEnvDetails = await this.environmentReposistory.get(
        globalEnvironment.id.toString(),
      );
      let environmentData;
      if (environmentId) {
        try {
          environmentData =
            await this.environmentReposistory.get(environmentId);
        } catch (err) {}
      }
      const activeVariables = this.combineEnvironmentData(
        globalEnvDetails?.variable || [],
        environmentData?.variable || [],
      );
      // Build proxy URL
      const sparrowProxy = this.configService.get<string>(
        "sparrowProxy.baseUrl",
      );
      const proxyUrl = `${sparrowProxy}/proxy/testflow/execute`;
      // Prepare request body for proxy API
      const body = {
        nodes: testflowDetails.nodes || [],
        variables: activeVariables || [],
        edges: testflowDetails.edges,
        userId: user?._id || new ObjectId("000000000000000000000000"),
      };
      const response = await axios.post(proxyUrl, body, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      const finalResult = {
        result: response.data,
        environmentName: environmentData?.name,
        nodes: testflowDetails.nodes,
        edges: testflowDetails.edges,
      };
      return finalResult;
    } catch (error: any) {
      return {
        result: {
          history: {
            status: "error",
          },
        },
        environmentName: "",
        nodes: [],
        edges: [],
      };
    }
  };

  public async handleTestflowDataSetRun(
    environmentId: string,
    workspaceId: string,
    testflowId: string,
    testflowDataSetId: string,
    user?: DecodedUserObject,
  ): Promise<any> {
    try {
      // Fetch testflow details
      const testflowDetails = await this.testflowRepository.get(testflowId);
      if (!testflowDetails) {
        throw new NotFoundException("Testflow not found");
      }

      // Fetch dataset details
      const testflowDataSet = await this.testflowRepository.getDataset(
        testflowId,
        testflowDataSetId,
      );
      if (!testflowDataSet) {
        throw new NotFoundException("Testflow dataset not found");
      }

      // Fetch workspace and global environment details
      const workspace = await this.workspaceReposistory.get(workspaceId);
      if (!workspace) {
        throw new NotFoundException("Workspace not found");
      }

      const globalEnvironment = workspace.environments?.[0];
      const globalEnvDetails = await this.environmentReposistory.get(
        globalEnvironment.id.toString(),
      );

      // Attempt to fetch specific environment if provided
      let environmentData = null;
      if (environmentId) {
        try {
          environmentData =
            await this.environmentReposistory.get(environmentId);
        } catch {
          // Fallback if environment not found or error occurs
          environmentData = null;
        }
      }

      // Combine global + environment-specific variables
      const activeVariables = this.combineEnvironmentData(
        globalEnvDetails?.variable || [],
        environmentData?.variable || [],
      );

      // Build proxy URL
      const sparrowProxy = this.configService.get<string>(
        "sparrowProxy.baseUrl",
      );
      if (!sparrowProxy) {
        throw new Error("Sparrow Proxy base URL not configured");
      }

      const proxyUrl = `${sparrowProxy}/proxy/testflow/execute`;

      // Format nodes using dataset
      const dataSetNodes = await this.formatTestflowNodes(
        testflowDetails.nodes,
        testflowDataSet.item,
      );

      const dataSetResult = [];

      // Run dataset groups one by one
      for (const dataSet of dataSetNodes) {
        const body = {
          nodes: dataSet || [],
          variables: activeVariables || [],
          edges: testflowDetails.edges,
          userId: user?._id || new ObjectId("000000000000000000000000"),
        };

        const response = await axios.post(proxyUrl, body, {
          headers: { "Content-Type": "application/json" },
        });

        dataSetResult.push({
          result: response.data,
          environmentName:
            environmentData?.name || globalEnvDetails?.name || "",
          nodes: testflowDetails.nodes,
          edges: testflowDetails.edges,
        });
      }

      return dataSetResult;
    } catch (error) {
      console.error("Error running Testflow dataset:", error.message);

      return [
        {
          result: {
            history: {
              status: "error",
              message: error.message || "Failed to execute testflow dataset",
            },
          },
          environmentName: "",
          nodes: [],
          edges: [],
        },
      ];
    }
  }

  private async formatTestflowNodes(
    nodes: TestflowNodes[],
    testflowDataSet: TestflowDataSet,
  ): Promise<TestflowNodes[][]> {
    const formattedDataSetNodes: TestflowNodes[][] = [];
    const testflowDataItems: DataSetGroup[] = testflowDataSet.dataSet;

    for (const testflowDataItem of testflowDataItems) {
      const formattedNodes: TestflowNodes[] = [];
      const testflowRequestData = testflowDataItem.data;

      for (const request of testflowRequestData) {
        if (!request?.id) continue;

        const currentNode = nodes.find(
          (node) =>
            node.id === request.id.toString() &&
            node.data?.blockName?.trim().toLowerCase() ===
              request.name?.trim().toLowerCase(),
        );

        if (!currentNode) continue;

        const requestData = currentNode.data.requestData;

        // Headers
        if (request.headers) {
          requestData.headers = request.headers;
        }

        // Query Params
        if (request.params) {
          requestData.queryParams = request.params;
        }

        // Body
        if (request.body) {
          requestData.body = request.body;
          requestData.selectedRequestBodyType =
            request.bodyType ?? BodyModeEnum["application/json"];
        }

        // Auth
        if (request.auth) {
          switch (request.auth.type) {
            case "apiKey":
              requestData.auth = {
                bearerToken: "",
                basicAuth: { username: "", password: "" },
                apiKey: {
                  authKey: request.auth.key,
                  authValue: request.auth.value,
                  addTo: request.auth.addTo,
                },
              };
              break;

            case "basicAuth":
              requestData.auth = {
                bearerToken: "",
                basicAuth: {
                  username: request.auth.username,
                  password: request.auth.password,
                },
                apiKey: { authKey: "", authValue: "", addTo: AddTo.Header },
              };
              break;

            case "bearerToken":
              requestData.auth = {
                bearerToken: request.auth.bearerToken,
                basicAuth: { username: "", password: "" },
                apiKey: { authKey: "", authValue: "", addTo: AddTo.Header },
              };
              break;

            case "none":
              requestData.auth = {};
              break;
          }
        }
        formattedNodes.push(currentNode);
      }
      // Push formatted nodes for this dataset group
      formattedDataSetNodes.push(formattedNodes);
    }
    return formattedDataSetNodes;
  }
}
