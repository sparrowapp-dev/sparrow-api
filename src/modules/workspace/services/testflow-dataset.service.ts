import { Injectable, BadRequestException } from "@nestjs/common";
import {
  FormatType,
  TestflowDataSet,
  TestflowDataSetItem,
} from "@src/modules/common/models/testflow.model";
import { v4 as uuidv4 } from "uuid";
import { TestflowRepository } from "../repositories/testflow.repository";

@Injectable()
export class TestflowDataSetService {
  constructor(private readonly testflowRepository: TestflowRepository) {}

  async importData(
    testflowId: string,
    testflowData: TestflowDataSet,
    formatType: FormatType,
    userId?: string,
  ) {
    // Check if dataSet array exists and has at least one dataset
    if (!testflowData?.dataSet || testflowData?.dataSet?.length === 0) {
      throw new BadRequestException(
        "Dataset must contain at least one dataset group",
      );
    }

    // Check if at least one dataset has at least one request
    const hasAtLeastOneRequest = testflowData.dataSet.some(
      (datasetGroup) => datasetGroup.data && datasetGroup.data.length > 0,
    );

    if (!hasAtLeastOneRequest) {
      throw new BadRequestException(
        "At least one dataset must contain at least one request",
      );
    }

    // Validate each dataset and check for variables
    for (const datasetGroup of testflowData.dataSet) {
      if (!datasetGroup.data || datasetGroup.data.length === 0) {
        continue; // Skip empty dataset groups
      }

      for (const request of datasetGroup.data) {
        // Check if the request contains variables ({{variable_name}})
        const hasVariables = this.checkForVariables(request);

        if (hasVariables) {
          // If variables exist, validate the format strictly
          this.validateRequestFormat(request, datasetGroup.no);
        }
      }
    }

    // Calculate file size (approximate)
    const dataSize = JSON.stringify(testflowData).length;
    const fileSizeKB = (dataSize / 1024).toFixed(2);

    // Create dataset item
    const dataSetId = uuidv4();
    const testflowDataSetItem: TestflowDataSetItem = {
      id: dataSetId,
      item: testflowData,
      formatType,
      fileSize: `${fileSizeKB}kb`,
      createdAt: new Date(),
      createdBy: userId,
    };

    // Add dataset to testflow
    await this.testflowRepository.addDataset(testflowId, testflowDataSetItem);

    // If all validations pass, proceed with import
    return {
      success: true,
      message: "Dataset imported successfully",
      data: testflowDataSetItem,
    };
  }

  /**
   * Check if a request contains variables in the format {{variable_name}}
   * @param request - The request to check
   * @returns true if variables are found
   */
  private checkForVariables(request: any): boolean {
    const variablePattern = /\{\{[^}]+\}\}/;

    // Check in name
    if (request.name && variablePattern.test(request.name)) {
      return true;
    }

    // Check in headers (KeyValue array)
    if (request.headers && Array.isArray(request.headers)) {
      for (const header of request.headers) {
        if (
          variablePattern.test(header.key || "") ||
          variablePattern.test(header.value || "")
        ) {
          return true;
        }
      }
    }

    // Check in params (KeyValue array)
    if (request.params && Array.isArray(request.params)) {
      for (const param of request.params) {
        if (
          variablePattern.test(param.key || "") ||
          variablePattern.test(param.value || "")
        ) {
          return true;
        }
      }
    }

    // Check in body (SparrowRequestBody structure)
    if (
      request.body &&
      typeof request.body === "object" &&
      Object.keys(request.body).length > 0
    ) {
      // Check raw body
      if (
        request.body.raw &&
        typeof request.body.raw === "string" &&
        variablePattern.test(request.body.raw)
      ) {
        return true;
      }

      // Check urlencoded body (KeyValue array)
      if (request.body.urlencoded && Array.isArray(request.body.urlencoded)) {
        for (const field of request.body.urlencoded) {
          if (
            variablePattern.test(field.key || "") ||
            variablePattern.test(field.value || "")
          ) {
            return true;
          }
        }
      }

      // Check formdata body (FormData structure with text array)
      if (request.body.formdata && typeof request.body.formdata === "object") {
        if (Array.isArray(request.body.formdata.text)) {
          for (const field of request.body.formdata.text) {
            if (
              variablePattern.test(field.key || "") ||
              variablePattern.test(String(field.value || ""))
            ) {
              return true;
            }
          }
        }
      }
    }

    // Check in auth
    if (request.auth) {
      const authStr = JSON.stringify(request.auth);
      if (variablePattern.test(authStr)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate request format strictly when variables are present
   * @param request - The request to validate
   * @param datasetNo - Dataset number for error messages
   * @throws BadRequestException if format is invalid
   */
  private validateRequestFormat(request: any, datasetNo: number): void {
    // Validate required fields
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

    // Validate bodyType (BodyModeEnum)
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

    // Validate headers format (KeyValue array)
    if (request.headers) {
      if (!Array.isArray(request.headers)) {
        throw new BadRequestException(
          `Dataset ${datasetNo}, Request "${request.name}": headers must be an array`,
        );
      }

      for (let i = 0; i < request.headers.length; i++) {
        const header = request.headers[i];
        if (
          typeof header.key !== "string" ||
          typeof header.value !== "string"
        ) {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${request.name}": header at index ${i} must have string key and value`,
          );
        }
        if (
          header.checked !== undefined &&
          typeof header.checked !== "boolean"
        ) {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${request.name}": header at index ${i} checked field must be boolean`,
          );
        }
      }
    }

    // Validate params format (KeyValue array)
    if (request.params) {
      if (!Array.isArray(request.params)) {
        throw new BadRequestException(
          `Dataset ${datasetNo}, Request "${request.name}": params must be an array`,
        );
      }

      for (let i = 0; i < request.params.length; i++) {
        const param = request.params[i];
        if (typeof param.key !== "string" || typeof param.value !== "string") {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${request.name}": param at index ${i} must have string key and value`,
          );
        }
        if (param.checked !== undefined && typeof param.checked !== "boolean") {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${request.name}": param at index ${i} checked field must be boolean`,
          );
        }
      }
    }

    // Validate body format based on bodyType
    this.validateBodyFormat(request, datasetNo);

    // Validate auth format
    this.validateAuthFormat(request, datasetNo);
  }

  /**
   * Validate body format based on bodyType (SparrowRequestBody structure)
   * @param request - The request to validate
   * @param datasetNo - Dataset number for error messages
   * @throws BadRequestException if body format is invalid
   */
  private validateBodyFormat(request: any, datasetNo: number): void {
    const { bodyType, body, name } = request;

    if (!body) {
      return; // Body is optional
    }
    if (!body || typeof body !== "object") {
      return;
    }

    // Validate based on bodyType
    if (
      bodyType === "application/json" ||
      bodyType === "application/xml" ||
      bodyType === "application/javascript" ||
      bodyType === "text/plain" ||
      bodyType === "text/html"
    ) {
      // These types use raw body
      if (body.raw !== undefined && typeof body.raw !== "string") {
        throw new BadRequestException(
          `Dataset ${datasetNo}, Request "${name}": body.raw must be a string for bodyType "${bodyType}"`,
        );
      }
    } else if (bodyType === "application/x-www-form-urlencoded") {
      // URL encoded uses urlencoded array
      if (body.urlencoded && !Array.isArray(body.urlencoded)) {
        throw new BadRequestException(
          `Dataset ${datasetNo}, Request "${name}": body.urlencoded must be an array`,
        );
      }

      if (Array.isArray(body.urlencoded)) {
        for (let i = 0; i < body.urlencoded.length; i++) {
          const field = body.urlencoded[i];
          if (
            typeof field.key !== "string" ||
            typeof field.value !== "string"
          ) {
            throw new BadRequestException(
              `Dataset ${datasetNo}, Request "${name}": urlencoded body field at index ${i} must have string key and value`,
            );
          }
          if (
            field.checked !== undefined &&
            typeof field.checked !== "boolean"
          ) {
            throw new BadRequestException(
              `Dataset ${datasetNo}, Request "${name}": urlencoded body field at index ${i} checked must be boolean`,
            );
          }
        }
      }
    } else if (bodyType === "multipart/form-data") {
      // Form data uses formdata object
      if (body.formdata && typeof body.formdata !== "object") {
        throw new BadRequestException(
          `Dataset ${datasetNo}, Request "${name}": body.formdata must be an object`,
        );
      }

      if (body.formdata && typeof body.formdata === "object") {
        // Validate text fields array
        if (body.formdata.text && !Array.isArray(body.formdata.text)) {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": formdata.text must be an array`,
          );
        }

        if (Array.isArray(body.formdata.text)) {
          for (let i = 0; i < body.formdata.text.length; i++) {
            const field = body.formdata.text[i];
            if (typeof field.key !== "string") {
              throw new BadRequestException(
                `Dataset ${datasetNo}, Request "${name}": formdata text field at index ${i} must have string key`,
              );
            }
            if (field.type && field.type !== "text" && field.type !== "file") {
              throw new BadRequestException(
                `Dataset ${datasetNo}, Request "${name}": formdata text field at index ${i} type must be "text" or "file"`,
              );
            }
            if (
              field.checked !== undefined &&
              typeof field.checked !== "boolean"
            ) {
              throw new BadRequestException(
                `Dataset ${datasetNo}, Request "${name}": formdata text field at index ${i} checked must be boolean`,
              );
            }
          }
        }
      }
    }
  }

  /**
   * Validate auth formats
   * @param request - The request to validate
   * @param datasetNo - Dataset number for error messages
   * @throws BadRequestException if auth format is invalid
   */
  private validateAuthFormat(request: any, datasetNo: number): void {
    const { auth, name } = request;

    if (!auth) {
      return; // Auth is optional
    }
    if (!auth || typeof auth !== "object") {
      return;
    }
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

    // Validate based on auth type
    switch (auth.type) {
      case "bearerToken":
        if (!auth.bearerToken || typeof auth.bearerToken !== "string") {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": bearerToken auth must have a valid bearerToken string`,
          );
        }
        break;

      case "basicAuth":
        if (!auth.username || typeof auth.username !== "string") {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": basicAuth must have a valid username string`,
          );
        }
        if (!auth.password || typeof auth.password !== "string") {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": basicAuth must have a valid password string`,
          );
        }
        break;

      case "apiKey":
        if (!auth.key || typeof auth.key !== "string") {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": apiKey auth must have a valid key string`,
          );
        }
        if (!auth.value || typeof auth.value !== "string") {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": apiKey auth must have a valid value string`,
          );
        }
        if (!auth.addTo || !["header", "query"].includes(auth.addTo)) {
          throw new BadRequestException(
            `Dataset ${datasetNo}, Request "${name}": apiKey auth addTo must be "header" or "query"`,
          );
        }
        break;

      case "none":
        // No additional validation needed for none type
        break;
    }
  }
}
