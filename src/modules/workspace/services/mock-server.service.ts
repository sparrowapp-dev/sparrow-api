import { Injectable, NotFoundException } from "@nestjs/common";
import { FastifyReply, FastifyRequest, HTTPMethods } from "fastify";
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
    res?: FastifyReply,
  ): Promise<MockRequestResponseDto> {
    try {
      const startTime = Date.now();
      const url = req.url; // e.g. /api/mock/6825983c9ab55fe3b6dcc05f/user
      const method = req.method.toUpperCase();

      // Extract collectionId
      const segments = url.split("/");
      const collectionId = segments[3] || null; // 3rd index (after /api/mock)
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
                mock?.url === mockUrl &&
                mock?.method?.toUpperCase() === method
              ) {
                const responseData = {
                  status:
                    mock?.responseStatus && mock.responseStatus !== ""
                      ? mock.responseStatus
                      : 200,
                  body: mock.responseBody ?? "",
                  contentType: mock.selectedResponseBodyType,
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
                  responseStatus: responseData.status,
                  duration: duration,
                  requestHeaders: mock.headers,
                  requestBody: mock.body,
                  selectedRequestBodyType: mock.selectedRequestBodyType,
                  selectedResponseBodyType: mock.selectedResponseBodyType,
                  responseHeaders: mock.responseHeaders,
                  responseBody: mock?.responseBody ?? "",
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
