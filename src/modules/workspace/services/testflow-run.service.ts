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
          nodes: dataSet,
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
    let formattedDataSetNodes: TestflowNodes[][] = [];
    let testflowDataItems: DataSetGroup[] = testflowDataSet.dataSet;
    // Iterate through each dataset group
    for (
      let datasetIndex = 0;
      datasetIndex < testflowDataItems.length;
      datasetIndex++
    ) {
      let formattedNodes: TestflowNodes[] = [];
      let currentDatasetGroup = testflowDataItems[datasetIndex];
      // Iterate through each node
      for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        // Create a deep copy of the node for each dataset group
        let currentNode = JSON.parse(JSON.stringify(nodes[nodeIndex]));
        // Push the first dummy node (startBlock) and continue
        if (currentNode.id === "1" || currentNode.type === "startBlock") {
          formattedNodes.push(currentNode);
          continue;
        }

        // Get the corresponding request data (nodeIndex - 1 because we skip first node)
        let requestDataIndex = nodeIndex - 1;
        let requestData = currentDatasetGroup.data[requestDataIndex];

        if (!requestData) {
          continue;
        }

        let nodeRequestData = currentNode.data.requestData;

        // Headers
        if (requestData.headers && requestData.headers.length > 0) {
          nodeRequestData.headers = requestData.headers;
        }

        // Query Params
        if (requestData.params && requestData.params.length > 0) {
          nodeRequestData.queryParams = requestData.params;
        }

        // Body
        if (requestData.body) {
          // JSON or raw body
          if (
            requestData.body.raw &&
            requestData.bodyType === BodyModeEnum["application/json"]
          ) {
            nodeRequestData.body = requestData.body;
            nodeRequestData.selectedRequestBodyType =
              BodyModeEnum["application/json"];
          }

          // XML
          else if (
            requestData.body.raw &&
            requestData.bodyType === BodyModeEnum["application/xml"]
          ) {
            nodeRequestData.body = requestData.body;
            nodeRequestData.selectedRequestBodyType =
              BodyModeEnum["application/xml"];
          }

          // URL-encoded form
          else if (
            requestData.body.urlencoded &&
            requestData.bodyType ===
              BodyModeEnum["application/x-www-form-urlencoded"]
          ) {
            nodeRequestData.body.urlencoded = requestData.body.urlencoded;
            nodeRequestData.selectedRequestBodyType =
              BodyModeEnum["application/x-www-form-urlencoded"];
          }

          // Multipart form data
          else if (
            requestData.body.formdata &&
            requestData.bodyType === BodyModeEnum["multipart/form-data"]
          ) {
            nodeRequestData.body.formdata = requestData.body.formdata;
            nodeRequestData.selectedRequestBodyType =
              BodyModeEnum["multipart/form-data"];
          }

          // JavaScript
          else if (
            requestData.body.raw &&
            requestData.bodyType === BodyModeEnum["application/javascript"]
          ) {
            nodeRequestData.body = requestData.body;
            nodeRequestData.selectedRequestBodyType =
              BodyModeEnum["application/javascript"];
          }

          // Plain text
          else if (
            requestData.body.raw &&
            requestData.bodyType === BodyModeEnum["text/plain"]
          ) {
            nodeRequestData.body = requestData.body;
            nodeRequestData.selectedRequestBodyType =
              BodyModeEnum["text/plain"];
          }

          // HTML
          else if (
            requestData.body.raw &&
            requestData.bodyType === BodyModeEnum["text/html"]
          ) {
            nodeRequestData.body = requestData.body;
            nodeRequestData.selectedRequestBodyType = BodyModeEnum["text/html"];
          }

          // Default fallback if type not matched
          else if (requestData.body.raw) {
            nodeRequestData.body = requestData.body;
            nodeRequestData.selectedRequestBodyType =
              BodyModeEnum["application/json"];
          }
        }

        // Auth
        if (requestData.auth && requestData.auth.type) {
          switch (requestData.auth.type) {
            case "apiKey":
              nodeRequestData.auth = {
                bearerToken: "",
                basicAuth: { username: "", password: "" },
                apiKey: {
                  authKey: requestData.auth.key,
                  authValue: requestData.auth.value,
                  addTo: requestData.auth.addTo,
                },
              };
              nodeRequestData.selectedRequestAuthType = "API Key";
              break;

            case "basicAuth":
              nodeRequestData.auth = {
                bearerToken: "",
                basicAuth: {
                  username: requestData.auth.username,
                  password: requestData.auth.password,
                },
                apiKey: { authKey: "", authValue: "", addTo: AddTo.Header },
              };
              nodeRequestData.selectedRequestAuthType = "Basic Auth";
              break;

            case "bearerToken":
              nodeRequestData.auth = {
                bearerToken: requestData.auth.bearerToken,
                basicAuth: { username: "", password: "" },
                apiKey: { authKey: "", authValue: "", addTo: AddTo.Header },
              };
              nodeRequestData.selectedRequestAuthType = "Bearer Token";
              break;

            case "none":
              nodeRequestData.auth = {};
              nodeRequestData.selectedRequestAuthType = "No Auth";
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
