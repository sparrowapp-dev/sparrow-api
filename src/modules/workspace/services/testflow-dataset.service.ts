import { Injectable, BadRequestException } from "@nestjs/common";
import {
  FormatType,
  TestflowDataSet,
  TestflowDataSetItem,
} from "@src/modules/common/models/testflow.model";
import { v4 as uuidv4 } from "uuid";
import { TestflowRepository } from "../repositories/testflow.repository";
import { TestflowRunService } from "./testflow-run.service";

@Injectable()
export class TestflowDataSetService {
  constructor(
    private readonly testflowRepository: TestflowRepository,
    private readonly testflowRunService: TestflowRunService,
  ) {}

  async importData(
    testflowId: string,
    testflowData: TestflowDataSet,
    formatType: FormatType,
    testdataName: string,
    userId?: string,
  ) {
    // Check if dataset exists
    if (!testflowData?.dataSet || testflowData.dataSet.length === 0) {
      throw new BadRequestException(
        "Dataset must contain at least one dataset group",
      );
    }

    // Ensure at least one dataset contains one request
    const hasAtLeastOneRequest = testflowData.dataSet.some(
      (datasetGroup) => datasetGroup.data && datasetGroup.data.length > 0,
    );
    if (!hasAtLeastOneRequest) {
      throw new BadRequestException(
        "At least one dataset must contain at least one request",
      );
    }

    // Validate format of all dataset requests
    for (const datasetGroup of testflowData.dataSet) {
      if (!datasetGroup.data || datasetGroup.data.length === 0) continue;
      for (const request of datasetGroup.data) {
        this.validateRequestFormat(request, datasetGroup.no);
      }
    }

    // Calculate file size (approximate)
    const dataSize = JSON.stringify(testflowData).length;
    const fileSizeKB = (dataSize / 1024).toFixed(2);

    // Create dataset item
    const dataSetId = uuidv4();
    const testflowDataSetItem: TestflowDataSetItem = {
      id: dataSetId,
      name: testdataName,
      item: testflowData,
      formatType,
      fileSize: `${fileSizeKB}kb`,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: userId,
      createdBy: userId,
    };

    // Add dataset to testflow
    const response = await this.testflowRepository.addDataset(
      testflowId,
      testflowDataSetItem,
    );

    return {
      success: true,
      message: "Dataset imported successfully",
      data: response,
    };
  }

  /**
   * Validate request format strictly (no variable check)
   */
  private validateRequestFormat(request: any, datasetNo: number): void {
    if (!request.id || typeof request.id !== "number") {
      throw new BadRequestException(
        `Dataset ${datasetNo}: Request must have a valid numeric ID`,
      );
    }

    if (!request.name || typeof request.name !== "string") {
      throw new BadRequestException(
        `Dataset ${datasetNo}: Request ID ${request.id} must have a valid name`,
      );
    }

    // Validate bodyType
    const validBodyTypes = [
      "application/json",
      "application/xml",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "application/javascript",
      "text/plain",
      "text/html",
    ];
    if (!request.bodyType || !validBodyTypes.includes(request.bodyType)) {
      throw new BadRequestException(
        `Dataset ${datasetNo}, Request "${request.name}": bodyType must be one of ${validBodyTypes.join(", ")}`,
      );
    }

    // Validate headers & params
    this.validateKeyValueArray(
      request.headers,
      "headers",
      request.name,
      datasetNo,
    );
    this.validateKeyValueArray(
      request.params,
      "params",
      request.name,
      datasetNo,
    );

    // Validate body & auth
    this.validateBodyFormat(request, datasetNo);
    this.validateAuthFormat(request, datasetNo);
  }

  /**
   * Generic KeyValue[] validation
   */
  private validateKeyValueArray(
    arr: any[],
    fieldName: string,
    reqName: string,
    datasetNo: number,
  ) {
    if (!arr) return;
    if (!Array.isArray(arr)) {
      throw new BadRequestException(
        `Dataset ${datasetNo}, Request "${reqName}": ${fieldName} must be an array`,
      );
    }

    arr.forEach((item, i) => {
      if (typeof item.key !== "string" || typeof item.value !== "string") {
        throw new BadRequestException(
          `Dataset ${datasetNo}, Request "${reqName}": ${fieldName} at index ${i} must have string key and value`,
        );
      }
      if (item.checked !== undefined && typeof item.checked !== "boolean") {
        throw new BadRequestException(
          `Dataset ${datasetNo}, Request "${reqName}": ${fieldName} at index ${i} checked field must be boolean`,
        );
      }
    });
  }

  /**
   * Validate body based on type
   */
  private validateBodyFormat(request: any, datasetNo: number): void {
    const { bodyType, body, name } = request;
    if (!body) return;

    if (typeof body !== "object") {
      throw new BadRequestException(
        `Dataset ${datasetNo}, Request "${name}": body must be an object`,
      );
    }

    switch (bodyType) {
      case "application/json":
      case "application/xml":
      case "application/javascript":
      case "text/plain":
      case "text/html":
        if (body.raw !== undefined && typeof body.raw !== "string") {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": body.raw must be a string for type "${bodyType}"`,
          );
        }
        break;

      case "application/x-www-form-urlencoded":
        this.validateKeyValueArray(
          body.urlencoded,
          "body.urlencoded",
          name,
          datasetNo,
        );
        break;

      case "multipart/form-data":
        if (body.formdata && typeof body.formdata === "object") {
          if (Array.isArray(body.formdata.text)) {
            body.formdata.text.forEach((field: any, i: any) => {
              if (typeof field.key !== "string") {
                throw new BadRequestException(
                  `Dataset ${datasetNo}, Request "${name}": formdata text field ${i} must have string key`,
                );
              }
              if (field.type && !["text", "file"].includes(field.type)) {
                throw new BadRequestException(
                  `Dataset ${datasetNo}, Request "${name}": formdata text field ${i} type must be "text" or "file"`,
                );
              }
            });
          }
        }
        break;
    }
  }

  /**
   * Validate auth fields
   */
  private validateAuthFormat(request: any, datasetNo: number): void {
    const { auth, name } = request;
    if (!auth) return;

    if (!auth.type) {
      throw new BadRequestException(
        `Dataset ${datasetNo}, Request "${name}": auth must have a type field`,
      );
    }

    const validAuthTypes = ["bearerToken", "basicAuth", "apiKey", "none"];
    if (!validAuthTypes.includes(auth.type)) {
      throw new BadRequestException(
        `Dataset ${datasetNo}, Request "${name}": auth type must be one of ${validAuthTypes.join(", ")}`,
      );
    }

    switch (auth.type) {
      case "bearerToken":
        if (typeof auth.bearerToken !== "string") {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": bearerToken must be a string`,
          );
        }
        break;
      case "basicAuth":
        if (
          typeof auth.username !== "string" ||
          typeof auth.password !== "string"
        ) {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": basicAuth must have string username and password`,
          );
        }
        break;
      case "apiKey":
        if (
          typeof auth.key !== "string" ||
          typeof auth.value !== "string" ||
          !["Header", "Query Parameter"].includes(auth.addTo)
        ) {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": apiKey must have string key/value and addTo as "header" or "query"`,
          );
        }
        break;
      case "none":
        break;
    }
  }
}
