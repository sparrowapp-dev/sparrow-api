// src/excel/excel.service.ts
import { Injectable } from "@nestjs/common";
import * as ExcelJS from "exceljs";
import {
  UserExcelDto,
  WorkspaceExcelDto,
} from "../payloads/downgrade-user.payload";

@Injectable()
export class ExcelEmailService {
  /**
   * Generate downgrade summary Excel with deleted workspaces and members
   */
  async generateDowngradeSummaryExcel(
    workspaces: WorkspaceExcelDto[],
    users: UserExcelDto[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    // Set workbook properties
    workbook.creator = "Sparrow";
    workbook.created = new Date();
    workbook.modified = new Date();
    // ==================== Deleted Workspaces Sheet ====================
    const workspacesSheet = workbook.addWorksheet("Deleted Workspaces", {
      properties: { tabColor: { argb: "FF316CF6" } },
    });
    // Define columns for workspaces
    workspacesSheet.columns = [
      { header: "Workspace Name", key: "name", width: 35 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Collections", key: "collections", width: 15 },
      { header: "Test Flows", key: "testflow", width: 15 },
    ];
    // Style header row for workspaces
    const workspaceHeaderRow = workspacesSheet.getRow(1);
    workspaceHeaderRow.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 12,
    };
    workspaceHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF316CF6" },
    };
    workspaceHeaderRow.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    workspaceHeaderRow.height = 25;
    // Add border to header
    workspaceHeaderRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    // Add workspace data
    workspaces.forEach((workspace, index) => {
      const row = workspacesSheet.addRow({
        name: workspace.name,
        created_at: workspace.created_at || "N/A",
        collections: workspace.collections,
        testflow: workspace.testflow,
      });
      // Alternate row colors for better readability
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8F9FA" },
        };
      }
      // Add borders to data cells
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          right: { style: "thin", color: { argb: "FFE0E0E0" } },
        };
        cell.alignment = { vertical: "middle" };
      });
    });
    // ==================== Deleted Members Sheet ====================
    const membersSheet = workbook.addWorksheet("Deleted Members", {
      properties: { tabColor: { argb: "FF316CF6" } },
    });
    // Define columns for members
    membersSheet.columns = [
      { header: "Name", key: "name", width: 30 },
      { header: "Email", key: "email", width: 40 },
      { header: "Role", key: "role", width: 15 },
    ];
    // Style header row for members
    const memberHeaderRow = membersSheet.getRow(1);
    memberHeaderRow.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 12,
    };
    memberHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF316CF6" },
    };
    memberHeaderRow.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    memberHeaderRow.height = 25;

    // Add border to header
    memberHeaderRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Add member data
    users.forEach((user, index) => {
      const row = membersSheet.addRow({
        name: user.name,
        email: user.email,
      });

      // Alternate row colors
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8F9FA" },
        };
      }

      // Add borders to data cells
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          right: { style: "thin", color: { argb: "FFE0E0E0" } },
        };
        cell.alignment = { vertical: "middle" };
      });
    });

    // Generate and return buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
