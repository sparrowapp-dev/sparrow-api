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

@Injectable()
export class TestflowDataSetService {
  constructor(private readonly testflowRepository: TestflowRepository) {}

  async importData(
    testflowId: string,
    testflowData: TestflowDataSetItemDto,
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

  private async validateDataSetGroups(
    items: Record<string, any>[],
  ): Promise<void> {
    for (let index = 0; index < items.length; index++) {
      const data = items[index];
      if (!data || typeof data !== "object") {
        throw new Error(
          `Item at index=${index} has invalid or missing data object.`,
        );
      }
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null || value === "") {
          throw new Error(
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
    const exists = testflow.datasets.some(
      (dataset) => dataset.name === datasetName.trim(),
    );
    return exists;
  }

  /**
   * Update specific fields of a dataset
   */
  async updateDatasetItem(
    testflowId: string,
    datasetId: string,
    updateData: Partial<
      Pick<TestflowDataSetItem, "name" | "item" | "fileUrl" | "updatedBy">
    >,
  ): Promise<any> {
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
      throw new NotFoundException("Dataset not found or no changes made");
    }
    return {
      message: "Dataset updated successfully",
      updated: true,
      result,
    };
  }

  /**
   * Delete a dataset item
   */
  async deleteDatasetItem(testflowId: string, datasetId: string): Promise<any> {
    const result = await this.testflowRepository.deleteDataset(
      testflowId,
      datasetId,
    );

    if (result.modifiedCount === 0) {
      throw new NotFoundException("Dataset not found");
    }
    return {
      message: "Dataset deleted successfully",
      deleted: true,
    };
  }
}
