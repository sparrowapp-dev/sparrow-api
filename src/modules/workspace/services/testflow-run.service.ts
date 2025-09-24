import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import axios from "axios";
import { Base64Converter } from "@src/modules/common/util/base64Converter";
import { StatusCode } from "@src/modules/common/util/status-code";
import { WorkspaceUserAgentBaseEnum } from "@src/modules/common/enum/roles.enum";
import { success, error } from "@src/modules/common/util/httpResponseFormat";
import { TestflowRepository } from "../repositories/testflow.repository";
import { EnvironmentRepository } from "../repositories/environment.repository";
import {
  TestflowSchedularHistoryRequest,
  TestFlowSchedularRunHistory,
} from "@src/modules/common/models/testflow.model";
import { TestflowRunHistory } from "@src/modules/common/models/plan.model";
import { DecodedUserObject } from "@src/types/fastify";
import { ParseTime } from "@src/modules/common/util/parse-time";
import { ResponseStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { TFAPIResponseType, TFKeyValueStoreType } from "@src/modules/common/enum/testflow.enum";

@Injectable()
export class TestflowRunService {
  constructor(
    private readonly testflowRepository: TestflowRepository,
    private readonly environmentReposistory: EnvironmentRepository,
  ) {}
  private readonly logger = new Logger(TestflowRunService.name);

  /**
   * Wrapper to handle HTTP requests (Cloud Agent + Browser Agent).
   */
  async makeHttpRequestV2(
    url: string,
    method: string,
    headers: string,
    body: string,
    contentType: string,
    selectedAgent: WorkspaceUserAgentBaseEnum,
    signal?: AbortSignal,
  ) {
    const startTime = performance.now();
    try {
      let response;
      // Cloud Agent (use localhost instead of constants)
      if (selectedAgent === "Cloud Agent") {
        const proxyUrl = `http://localhost:3001/proxy/http-request`; // 🔹 replace with your local service
        response = await Promise.race([
          axios({
            data: { url, method, headers, body, contentType },
            url: proxyUrl,
            method: "POST",
          }),
          this.waitForAbort(signal),
        ]);
      } else {
        // Browser Agent
        try {
          let jsonHeader;
          try {
            jsonHeader = JSON.parse(headers);
          } catch {
            jsonHeader = [];
          }

          const headersObject = jsonHeader.reduce(
            (
              acc: Record<string, string>,
              header: { key: string; value: string },
            ) => {
              acc[header.key] = header.value;
              return acc;
            },
            {},
          );
          let requestData = body || {};
          if (contentType === "multipart/form-data") {
            const formData = new FormData();
            const parsedBody = JSON.parse(body);
            for (const field of parsedBody || []) {
              try {
                if (field?.base) {
                  const file = await new Base64Converter().base64ToFile(
                    field.base,
                    field.value,
                  );
                  formData.append(field.key, file);
                } else {
                  formData.append(field.key, field.value);
                }
              } catch (e) {
                this.logger.error(e);
                formData.append(field.key, field.value);
              }
            }
            requestData = formData;
            delete headersObject["Content-Type"]; // let axios set boundary
          } else if (contentType === "application/x-www-form-urlencoded") {
            const urlSearchParams = new URLSearchParams();
            const parsedBody = JSON.parse(body);
            (parsedBody || []).forEach(
              (field: { key: string; value: string }) => {
                urlSearchParams.append(field.key, field.value);
              },
            );
            requestData = urlSearchParams;
          } else if (
            contentType === "application/json" ||
            contentType === "text/plain"
          ) {
            headersObject["Content-Type"] = contentType;
          }
          const axiosResponse = await Promise.race([
            axios({
              method,
              url,
              data: requestData || {},
              headers: { ...headersObject },
              responseType: "arraybuffer",
              validateStatus: () => true,
            }),
            this.waitForAbort(signal),
          ]);
          let responseData = "";
          const responseContentType =
            axiosResponse.headers["content-type"] || "";
          if (responseContentType.startsWith("image/")) {
            const base64 = btoa(
              new Uint8Array(axiosResponse.data).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                "",
              ),
            );
            responseData = `data:${contentType};base64,${base64}`;
            response = {
              data: {
                status: `${axiosResponse.status} ${
                  axiosResponse.statusText ||
                  new StatusCode().getText(axiosResponse.status)
                }`,
                data: responseData,
                headers: Object.fromEntries(
                  Object.entries(axiosResponse.headers),
                ),
              },
            };
          } else {
            responseData = new TextDecoder("utf-8").decode(axiosResponse.data);
            response = {
              data: {
                status: `${axiosResponse.status} ${new StatusCode().getText(
                  axiosResponse.status,
                )}`,
                data: responseData,
                headers: Object.fromEntries(
                  Object.entries(axiosResponse.headers),
                ),
              },
            };
          }
        } catch (axiosError: any) {
          if (signal?.aborted) {
            throw new Error();
          }
          return error(axiosError.message);
        }
      }
      if (signal?.aborted) {
        throw new DOMException("Request was aborted", "AbortError");
      }
      try {
        let responseData;
        if (typeof response.data.data !== "string") {
          responseData = JSON.stringify(response.data.data);
        } else {
          responseData = response.data.data;
        }
        if (!response.data.status) {
          throw new Error(
            response?.data?.data?.message || "Error parsing response",
          );
        }
        return success({
          body: responseData,
          status: response.data.status,
          headers: response.data.headers,
        });
      } catch (e) {
        this.logger.error("Response parsing error:", e);
        return error(e.toString());
      }
    } catch (e) {
      if (signal?.aborted) {
        throw new DOMException("Request was aborted", "AbortError");
      }
      this.logger.error("Request error:", e);
      throw new Error(String(e));
    }
  }

  async waitForAbort(signal: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
      if (signal?.aborted) {
        return reject(new Error("Aborted before starting"));
      }
      signal?.addEventListener(
        "abort",
        () => {
          reject(new Error("Aborted during request"));
        },
        { once: true },
      );
    });
  }

  public handleTestFlowRun = async (
    testflowId: string,
    environmentId: string,
    user: DecodedUserObject,
    selectedAgent?:WorkspaceUserAgentBaseEnum
  ) => {
    // if(!selectedAgent){
    //     selectedAgent = WorkspaceUserAgentBaseEnum.BROWSER_AGENT
    // }
    // const testflowData = await this.testflowRepository.get(testflowId);
    // const environmentData =
    //   await this.environmentReposistory.get(environmentId);
    // if (!testflowData) {
    //   throw new NotFoundException("Testflow not Found.");
    // }
    // if (!environmentData) {
    //   throw new NotFoundException("Environment not Found.");
    // }
    // const nodes = testflowData?.nodes || [];
    // const abortController = new AbortController();
    // const { signal } = abortController;
    // let successRequests = 0;
    // let failedRequests = 0;
    // let totalTime = 0;
    // const history: TestFlowSchedularRunHistory = {
    //   status: "fail",
    //   successRequests: 0,
    //   failedRequests: 0,
    //   totalTime: "",
    //   createdAt: new Date(),
    //   createdBy: user._id.toString(),
    //   requests: [],
    // };
    // let requestChainResponse: Record<string, any> = {};
    // const executedNodes: any[] = [];
    // for (const element of nodes) {
    //   if (element?.type !== "requestBlock" || !element?.data?.requestId)
    //     continue;
    //   const requestData = element.data.requestData;
    //   const decodeData = this._decodeRequest.init(
    //     adaptedRequest.property.request,
    //     environments?.filtered || [],
    //     requestChainResponse,
    //   );
    //   const start = Date.now();
    //   let resData: any;
    //   try {
    //     const response = await this.makeHttpRequestV2(
    //       decodeData[0],
    //       decodeData[1],
    //       decodeData[2],
    //       decodeData[3],
    //       decodeData[4],
    //       selectedAgent,
    //       signal,
    //     );
    //     const duration = Date.now() - start;
    //     if (response.isSuccessful) {
    //       const byteLength = new TextEncoder().encode(
    //         JSON.stringify(response),
    //       ).length;
    //       const responseSizeKB = byteLength / 1024;
    //       const responseData: TFAPIResponseType = response.data;
    //       const responseBody = responseData.body;
    //       const formattedHeaders = Object.entries(
    //         response?.data?.headers || {},
    //       ).map(([key, value]) => ({ key, value })) as TFKeyValueStoreType[];
    //       const responseStatus = response?.data?.status;
    //       resData = {
    //         body: responseBody,
    //         headers: formattedHeaders,
    //         status: responseStatus,
    //         time: duration,
    //         size: responseSizeKB,
    //         responseContentType:
    //           this._decodeRequest.setResponseContentType(formattedHeaders),
    //       };
    //       if (
    //         Number(resData.status.split(" ")[0]) >= 200 &&
    //         Number(resData.status.split(" ")[0]) < 300
    //       ) {
    //         successRequests++;
    //       } else {
    //         failedRequests++;
    //       }

    //       totalTime += duration;
    //       history.requests.push({
    //         method: request?.request?.method as string,
    //         name: request?.name as string,
    //         status: resData.status,
    //         time: new ParseTime().convertMilliseconds(duration),
    //       });
    //       // Build request/response for chaining
    //       const responseHeader =
    //         this._decodeRequest.setResponseContentType(formattedHeaders);
    //       const reqParam: Record<string, string> = {};
    //       const params = new URL(decodeData[0]).searchParams;
    //       for (const [key, value] of params.entries()) reqParam[key] = value;

    //       const headersObject = Object.fromEntries(
    //         JSON.parse(decodeData[2]).map(({ key, value }) => [key, value]),
    //       );

    //       let reqBody: any;
    //       if (decodeData[4] === "application/json") {
    //         try {
    //           reqBody = JSON.parse(decodeData[3]);
    //         } catch {
    //           reqBody = {};
    //         }
    //       } else if (
    //         decodeData[4] === "multipart/form-data" ||
    //         decodeData[4] === "application/x-www-form-urlencoded"
    //       ) {
    //         reqBody = Object.fromEntries(
    //           JSON.parse(decodeData[3]).map(({ key, value }) => [key, value]),
    //         );
    //       } else {
    //         reqBody = decodeData[3];
    //       }

    //       const responseObject = {
    //         response: {
    //           body:
    //             responseHeader === "JSON"
    //               ? JSON.parse(resData.body)
    //               : resData.body,
    //           headers: response?.data?.headers,
    //         },
    //         request: {
    //           headers: headersObject || {},
    //           body: reqBody,
    //           parameters: reqParam || {},
    //         },
    //       };

    //       requestChainResponse[
    //         "$$" + element.data.requestData.name.replace(/[^a-zA-Z0-9_]/g, "_")
    //       ] = responseObject;
    //       requestChainResponse[
    //         "$$" + element.data.blockName.replace(/[^a-zA-Z0-9_]/g, "_")
    //       ] = responseObject;
    //     } else {
    //       resData = {
    //         body: response.message,
    //         headers: [],
    //         status: ResponseStatusCode.ERROR,
    //         time: duration,
    //         size: 0,
    //       };
    //       failedRequests++;
    //       totalTime += duration;

    //       history.requests.push({
    //         method: request?.request?.method as string,
    //         name: request?.name as string,
    //         status: ResponseStatusCode.ERROR,
    //         time: new ParseTime().convertMilliseconds(duration),
    //       });
    //     }
    //   } catch (error) {
    //     console.error(error);
    //     if (error?.name === "AbortError") break;

    //     resData = {
    //       body: "",
    //       headers: [],
    //       status: ResponseStatusCode.ERROR,
    //       time: 0,
    //       size: 0,
    //     };

    //     failedRequests++;
    //     history.requests.push({
    //       method: request?.request?.method as string,
    //       name: request?.name as string,
    //       status: ResponseStatusCode.ERROR,
    //       time: "0 ms",
    //     });
    //   }

    //   executedNodes.push({
    //     id: element.id,
    //     response: resData,
    //     request: adaptedRequest,
    //   });
    // }

    // // Finalize history
    // history.totalTime = new ParseTime().convertMilliseconds(totalTime);
    // history.successRequests = successRequests;
    // history.failedRequests = failedRequests;
    // history.status = failedRequests === 0 ? "pass" : "fail";
    // return {
    //   history,
    //   requestChainResponse,
    //   nodes: executedNodes,
    // };
  };
}
