import { Injectable, NotFoundException } from "@nestjs/common";
import { FastifyRequest, HTTPMethods } from "fastify";
import { CollectionRepository } from "../repositories/collection.repository";
import { ObjectId } from "mongodb";
import { ConfigService } from "@nestjs/config";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { MockRequestResponseDto } from "../payloads/mock-server.payload";
import { v4 as uuidv4 } from "uuid";
import {
  BodyModeEnum,
  MockRequestHistory,
} from "@src/modules/common/models/collection.model";
import * as Sentry from "@sentry/nestjs";

/**
 * Mock Server Service - Service responsible for handling operations related to mock server and requests.
 */
@Injectable()
export class MockServerService {
  /**
   * Constructor to initialize MockServerService with required dependencies.
   */
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly configService: ConfigService,
  ) {}

  async handleMockRequests(
    req: FastifyRequest,
  ): Promise<MockRequestResponseDto> {
    try {
      const startTime = Date.now();
      const url = req.url; // e.g. /api/mock/6825983c9ab55fe3b6dcc05f/user
      const method = req.method.toUpperCase();
      // Get all query parameters as an array of key-value objects
      const queryParamsArray = Object.entries(req.query || {}).map(
        ([key, value]) => ({
          key,
          value,
        }),
      );

      console.log("Query params array:", queryParamsArray);

      // Extract collectionId
      const segments = url.split("/");
      let collectionId = segments[3] || null; // 3rd index (after /api/mock)
      // Remove query parameters from collectionId if they exist
      if (collectionId && collectionId.includes("?")) {
        collectionId = collectionId.split("?")[0];
      }
      // Extract the rest of the URL after the collection ID with leading slash
      let restUrl =
        segments.length > 4 ? "/" + segments.slice(4).join("/") : "";
      // Add query parameters to restUrl if they exist
      if (queryParamsArray.length > 0) {
        const queryString = queryParamsArray
          .map(
            ({ key, value }) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
          )
          .join("&");

        restUrl += `?${queryString}`;
      }
      console.log("Final restUrl with query params:", restUrl);
      if (collectionId) {
        const modifiedCollectionId = new ObjectId(collectionId);
        const collection =
          await this.collectionRepository.getMockCollection(
            modifiedCollectionId,
          );
        if (collection) {
          // Recursively collect all items (flattening folders)
          const flattenItems = (items: any[]): any[] => {
            return items.reduce((acc, item) => {
              if (item.type === "FOLDER" && item.items) {
                acc.push(...flattenItems(item.items)); // recursive dive
              } else {
                acc.push(item);
              }
              return acc;
            }, []);
          };

          const allItems = flattenItems(collection.items);

          for (const item of allItems) {
            if (item.type === "MOCK_REQUEST" && item.mockRequest) {
              const mock = item.mockRequest;
              const baseUrl = this.configService.get("app.url");
              const mockUrl = `${baseUrl}${url}`;

              if (
                mock?.url === restUrl &&
                mock?.method?.toUpperCase() === method
              ) {
                // Filter active mock responses
                const activeMockResponses =
                  item?.items?.filter(
                    (responseItem: any) =>
                      responseItem.mockRequestResponse?.isMockResponseActive ===
                      true,
                  ) || [];

                let selectedResponse = null;
                let responseStatus = 200;
                let responseBody = "";
                let selectedResponseBodyType = BodyModeEnum["text/plain"];
                let responseHeaders = [];

                // If there are active mock responses, randomly select one
                if (activeMockResponses?.length > 0) {
                  const randomIndex = Math.floor(
                    Math.random() * activeMockResponses.length,
                  );
                  selectedResponse = activeMockResponses[randomIndex];

                  responseStatus =
                    selectedResponse.mockRequestResponse?.responseStatus || 200;
                  responseBody =
                    selectedResponse.mockRequestResponse?.responseBody || "";
                  selectedResponseBodyType =
                    selectedResponse.mockRequestResponse
                      ?.selectedResponseBodyType ||
                    mock.selectedResponseBodyType;
                  responseHeaders =
                    selectedResponse.mockRequestResponse?.responseHeaders || [];
                } else {
                  // Fallback to original mock response if no active responses
                  responseStatus = 200;
                  responseBody = "";
                }
                // Filter headers that have key, value, are checked, and are valid HTTP headers
                const filteredResponseHeaders = responseHeaders.filter(
                  (header: any) => {
                    try {
                      // Basic checks
                      if (!header?.key || !header?.value || !header?.checked) {
                        return false;
                      }

                      const headerName = header.key.toString().trim();
                      const headerValue = header.value.toString().trim();

                      // Validate header name and value exist after trimming
                      if (!headerName || !headerValue) return false;

                      // Header name (key) length limit - typically 8KB but practically much smaller
                      // Most servers limit header names to 256 characters or less
                      if (headerName.length > 256) {
                        return false;
                      }

                      // Header value length limit - typically 8KB per header
                      // Some servers have stricter limits (4KB or less)
                      if (headerValue.length > 8192) {
                        return false;
                      }

                      // Validate header name (key) - must follow HTTP header name rules
                      // Only ASCII letters, digits, and hyphens allowed
                      const validHeaderNameRegex = /^[a-zA-Z0-9\-]+$/;
                      if (!validHeaderNameRegex.test(headerName)) {
                        return false;
                      }

                      // Header name cannot start or end with hyphen
                      if (
                        headerName.startsWith("-") ||
                        headerName.endsWith("-")
                      ) {
                        return false;
                      }

                      // Validate header value - should not contain control characters
                      // Allows printable ASCII + extended ASCII, plus tab (0x09)
                      const validHeaderValueRegex =
                        /^[\x09\x20-\x7E\x80-\xFF]*$/;
                      if (!validHeaderValueRegex.test(headerValue)) {
                        return false;
                      }

                      // Block certain headers that shouldn't be set manually
                      const blockedHeaders = [
                        "content-length",
                        "transfer-encoding",
                        "connection",
                        "upgrade",
                        "host",
                        "expect",
                        "trailer",
                      ];
                      if (blockedHeaders.includes(headerName.toLowerCase())) {
                        return false;
                      }

                      return true;
                    } catch (error) {
                      console.warn(
                        "Invalid header detected:",
                        header,
                        error.message,
                      );
                      Sentry.captureException(error.message);
                      return false;
                    }
                  },
                );
                const responseData = {
                  status: responseStatus,
                  body: responseBody,
                  contentType:
                    selectedResponseBodyType || BodyModeEnum["text/plain"],
                  responseHeaders: filteredResponseHeaders,
                };

                const duration = Math.round(Date.now() - startTime);

                const mockEndpoint = (url: string) => {
                  const regex = /\/api\/mock\/[a-f0-9]+(\/.*)/;
                  const match = url.match(regex);
                  return match ? match[1] : "";
                };

                const historyEntry: MockRequestHistory = {
                  id: uuidv4(),
                  timestamp: new Date(),
                  name: item.name,
                  url: mockEndpoint(url),
                  method: req.method as HTTPMethods,
                  responseStatus: responseData.status.toString(),
                  duration: duration,
                  requestHeaders: mock.headers,
                  requestBody: mock.body,
                  selectedRequestBodyType: mock.selectedRequestBodyType,
                  selectedResponseBodyType: responseData.contentType,
                  responseHeaders: responseData.responseHeaders,
                  responseBody: responseData?.body ?? "",
                };

                await this.storeRequestHistory(collectionId, historyEntry);
                return responseData;
              }
            }
          }

          const mockEndpoint = (url: string) => {
            const regex = /\/api\/mock\/[a-f0-9]+(\/.*)/;
            const match = url.match(regex);
            return match ? match[1] : "";
          };

          // Convert request headers to KeyValue format
          // const requestHeadersKV: KeyValue[] = Object.entries(req.headers).map(
          //   ([key, value]) => ({
          //     key,
          //     value: Array.isArray(value) ? value.join(", ") : String(value),
          //     checked: true,
          //   }),
          // );

          const duration = Math.round(Date.now() - startTime);
          const historyEntry: MockRequestHistory = {
            id: uuidv4(),
            timestamp: new Date(),
            name: "",
            url: mockEndpoint(url),
            method: req.method as HTTPMethods,
            responseStatus: HttpStatusCode.NOT_FOUND.toString(),
            duration: duration,
            requestHeaders: null,
            requestBody: null,
            selectedRequestBodyType: BodyModeEnum["text/plain"],
            selectedResponseBodyType: BodyModeEnum["text/plain"],
            responseHeaders: null,
            responseBody: "URL NOT FOUND",
          };

          await this.storeRequestHistory(collectionId, historyEntry);
          throw new NotFoundException("URL NOT FOUND");
        }
        return {
          status: HttpStatusCode.NOT_FOUND,
          body: "URL NOT FOUND",
        };
      }
    } catch (error) {
      throw new NotFoundException("URL NOT FOUND");
    }
  }

  /**
   * Stores a request history entry in the collection
   * @param collectionId Collection ID
   * @param historyEntry History entry to store
   */
  private async storeRequestHistory(
    collectionId: string,
    historyEntry: MockRequestHistory,
  ): Promise<void> {
    try {
      await this.collectionRepository.addMockRequestHistory(
        collectionId,
        historyEntry,
      );
    } catch (error) {
      console.error("Failed to store mock request history:", error);
    }
  }
}
