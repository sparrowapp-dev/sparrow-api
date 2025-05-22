import { Injectable, NotFoundException } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { CollectionRepository } from "../repositories/collection.repository";
import { ObjectId } from "mongodb";
import { ConfigService } from "@nestjs/config";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { MockRequestResponseDto } from "../payloads/mock-server.payload";

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
                return {
                  status:
                    mock.responseStatus !== "" ? mock.responseStatus : 200,
                  body: mock.responseBody ?? "",
                  contentType: mock.selectedResponseBodyType,
                };
              }
            }
          }
        } else {
          throw new NotFoundException("URL NOT FOUND");
        }
      }
      return {
        status: HttpStatusCode.NOT_FOUND,
        body: "URL NOT FOUND",
      };
    } catch (error) {
      throw new NotFoundException("URL NOT FOUND");
    }
  }
}
