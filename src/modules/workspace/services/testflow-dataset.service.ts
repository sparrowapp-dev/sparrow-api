import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  FormatType,
  TestflowDataSetItem,
  TestflowDataSetItemDto,
} from "@src/modules/common/models/testflow.model";
import { v4 as uuidv4 } from "uuid";
import { TestflowRepository } from "../repositories/testflow.repository";
import { UpdateTestflowDatasetDto } from "../payloads/testflow.payload";
import { TestflowService } from "./testflow.service";
import { DecodedUserObject } from "@src/types/fastify";

@Injectable()
export class TestflowDataSetService {
  constructor(
    private readonly testflowRepository: TestflowRepository,
    private readonly testflowService: TestflowService,
  ) {}

  async importData(
    testflowId: string,
    testflowData: TestflowDataSetItemDto,
    formatType: FormatType,
    testdataName: string,
    workspaceId: string,
    user?: DecodedUserObject,
  ) {
    await this.testflowService.isWorkspaceAdminorEditor(workspaceId, user._id);
    // Check if dataset exists
    if (!testflowData?.dataSet || testflowData.dataSet.length === 0) {
      throw new BadRequestException(
        "Dataset must contain at least one dataset group",
      );
    }
    if (testflowData.dataSet.length > 5) {
      throw new BadRequestException(
        "Dataset must contain less than 5 dataset group",
      );
    }

    await this.validateDataSetGroups(testflowData.dataSet);
    const alreadyExist = await this.validataDataSetSameName(
      testflowId,
      testdataName,
    );
    if (alreadyExist) {
      throw new BadRequestException("Dataset already exists");
    }
    // Calculate file size (approximate)
    const dataSize = JSON.stringify(testflowData).length;
    const fileSizeKB = (dataSize / 1024).toFixed(2);

    // Create dataset item
    const dataSetId = uuidv4();
    const testflowDataSetItem: TestflowDataSetItem = {
      id: dataSetId,
      name: testdataName.trim(),
      item: testflowData,
      formatType,
      fileSize: `${fileSizeKB}kb`,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: user._id.toString(),
      createdBy: user._id.toString(),
    };

    // Add dataset to testflow
    const response = await this.testflowRepository.addDataset(
      testflowId,
      testflowDataSetItem,
    );

    return {
      data: response,
    };
  }

  private async validateDataSetGroups(
    items: Record<string, string | number | boolean | null>[],
  ): Promise<void> {
    for (let index = 0; index < items.length; index++) {
      const data = items[index];
      if (!data || typeof data !== "object") {
        throw new BadRequestException(
          `Item at index=${index} has invalid or missing data object.`,
        );
      }
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null || value === "") {
          throw new BadRequestException(
            `Item at index=${index} has empty value for key '${key}'.`,
          );
        }
      }
    }
  }

  private async validataDataSetSameName(
    testflowId: string,
    datasetName: string,
  ) {
    const testflow = await this.testflowRepository.get(testflowId);
    if (!testflow) {
      throw new NotFoundException("Testflow not found");
    }
    if (testflow?.datasets) {
      const exists = testflow.datasets.some(
        (dataset) => dataset.name === datasetName.trim(),
      );
      return exists;
    }
    return false;
  }

  async changeImportFileName(
    testflowId: string,
    testflowData: TestflowDataSetItemDto,
    formatType: FormatType,
    testdataName: string,
    workspaceId: string,
    user?: DecodedUserObject,
  ) {
    await this.testflowService.isWorkspaceAdminorEditor(workspaceId, user._id);
    // Check if dataset exists
    if (!testflowData?.dataSet || testflowData.dataSet.length === 0) {
      throw new BadRequestException(
        "Dataset must contain at least one dataset group",
      );
    }
    if (testflowData.dataSet.length > 5) {
      throw new BadRequestException(
        "Dataset must contain fewer than 5 dataset groups",
      );
    }

    await this.validateDataSetGroups(testflowData.dataSet);
    const updateFileName = this.incrementOrAppendNumber(testdataName.trim());
    // Calculate file size (approximate)
    const dataSize = JSON.stringify(testflowData).length;
    const fileSizeKB = (dataSize / 1024).toFixed(2);

    // Create dataset item
    const dataSetId = uuidv4();
    const testflowDataSetItem: TestflowDataSetItem = {
      id: dataSetId,
      name: updateFileName,
      item: testflowData,
      formatType,
      fileSize: `${fileSizeKB}kb`,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: user._id.toString(),
      createdBy: user._id.toString(),
    };

    // Add dataset to testflow
    const response = await this.testflowRepository.addDataset(
      testflowId,
      testflowDataSetItem,
    );

    return {
      data: response,
    };
  }

  private incrementOrAppendNumber(fileName: string) {
    const match = fileName.match(/\d+/);
    if (match) {
      const number = match[0];
      const incremented = String(Number(number) + 1);
      return fileName.replace(number, incremented);
    } else {
      return fileName + "1";
    }
  }

  async locateAndUpdateFileByName(
    testflowData: UpdateTestflowDatasetDto,
    testflowId: string,
    workspaceId: string,
    user: DecodedUserObject,
  ) {
    await this.testflowService.isWorkspaceAdminorEditor(workspaceId, user._id);
    const payload: Partial<TestflowDataSetItem> = {
      item: testflowData.item,
      updatedAt: new Date(),
    };
    const reponse = await this.testflowRepository.updateDatasetByName(
      testflowId,
      testflowData.name,
      payload,
    );
    return reponse;
  }

  /**
   * Update specific fields of a dataset
   */
  async updateDatasetItem(
    testflowId: string,
    datasetId: string,
    updateData: Partial<
      Pick<TestflowDataSetItem, "name" | "item" | "updatedBy">
    >,
    workspaceId: string,
    user: DecodedUserObject,
  ): Promise<any> {
    await this.testflowService.isWorkspaceAdminorEditor(workspaceId, user._id);
    // Automatically set updatedAt
    const result = await this.testflowRepository.updateDataset(
      testflowId,
      datasetId,
      {
        ...updateData,
        updatedAt: new Date(),
      },
    );
    if (!result) {
      throw new NotFoundException("Dataset not found.");
    }
    return {
      result,
    };
  }

  /**
   * Delete a dataset item
   */
  async deleteDatasetItem(
    testflowId: string,
    datasetId: string,
    workspaceId: string,
    user: DecodedUserObject,
  ): Promise<any> {
    await this.testflowService.isWorkspaceAdminorEditor(workspaceId, user._id);
    const response = await this.testflowRepository.deleteDataset(
      testflowId,
      datasetId,
    );
    if (!response.datasets) {
      throw new NotFoundException("Dataset not found.");
    }
    return {
      result: response?.datasets || [],
    };
  }
}
