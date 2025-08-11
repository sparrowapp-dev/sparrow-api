import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AiLogService } from "../services/ai-log.service";
import { parse } from "json2csv";
import path from "path";
import * as fs from "fs";
import { EmailService } from "@src/modules/common/services/email.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AiConsumptionScheduler {
  constructor(
    private readonly aiLogService: AiLogService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async getLastWeekRange() {
    const now = new Date();

    // Last Saturday
    const end = new Date(now);
    end.setDate(end.getDate() - ((end.getDay() + 1) % 7)); // last Saturday
    end.setHours(23, 59, 59, 999);

    // Last Sunday
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }

  @Cron(CronExpression.EVERY_WEEK)
  async handleConsumption() {
    // This method will handle the AI consumption logic.
    // It can be used to schedule tasks related to AI consumption.
    console.log("Handling AI consumption logic...");
    // Calculate last Sunday to last Saturday
    const { start, end } = await this.getLastWeekRange();

    const cursor = await this.aiLogService.getTokenUsageReport(start, end);
    const rows = await cursor.toArray();
    console.log("Token usage rows:", rows);

    // Step 1: Build pivot table data structure
    const pivotData: Record<string, Record<string, number>> = {};
    const modelNames = new Set<string>();
    const grandTotalsByModel: Record<string, number> = {};
    let grandTotalTokens = 0;

    for await (const row of rows) {
      const userId = row._id.userId;
      const model = row._id.model;
      const tokens = row.totalTokens;

      modelNames.add(model);

      if (!pivotData[userId]) {
        pivotData[userId] = {};
      }
      pivotData[userId][model] = (pivotData[userId][model] || 0) + tokens;

      grandTotalsByModel[model] = (grandTotalsByModel[model] || 0) + tokens;
      grandTotalTokens += tokens;
    }

    const sortedModels = Array.from(modelNames).sort();

    // Step 2: Convert pivotData to array for CSV
    const csvRows = Object.entries(pivotData).map(([userId, modelTokens]) => {
      const row: any = { userId };
      let totalTokens = 0;

      for (const model of sortedModels) {
        const tokens = modelTokens[model] || 0;
        row[`${model} Tokens`] = tokens;
        totalTokens += tokens;
      }
      row["Total Tokens"] = totalTokens;
      return row;
    });

    // Step 3: Add Grand Total row
    const grandTotalRow: any = { userId: "GRAND TOTAL" };
    for (const model of sortedModels) {
      grandTotalRow[`${model} Tokens`] = grandTotalsByModel[model] || 0;
    }
    grandTotalRow["Total Tokens"] = grandTotalTokens;
    csvRows.push({});
    csvRows.push(grandTotalRow);

    // Step 4: Generate CSV
    const fields = [
      { label: "User ID", value: "userId" },
      ...sortedModels.map((model) => ({
        label: `${model} Tokens`,
        value: `${model} Tokens`,
      })),
      { label: "Total Tokens", value: "Total Tokens" },
    ];

    const csv = parse(csvRows, { fields });
    // Save to local file for checking
    const filePath = path.join(process.cwd(), "ai-logs-report.csv");
    // fs.writeFileSync(filePath, csv, "utf8");

    // console.log(`CSV report saved locally at: ${filePath}`);
    const transporter = this.emailService.createTransporter(false); // false = no handlebars
    // Format the date range for the email body
    const startDateStr = start.toISOString().slice(0, 10);
    const endDateStr = end.toISOString().slice(0, 10);

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      // to: email, // make sure 'email' is defined or replace with recipient
      subject: `AI Consumption Report: ${startDateStr} to ${endDateStr}`,
      text: `AI consumption report for the period: ${startDateStr} to ${endDateStr}`,
      attachments: [
        {
          filename: "ai-logs-report.csv",
          content: csv,
        },
      ],
    };
    // Read and parse the email list from env
    const emailListString =
      this.configService.get("sparrowAdmin.stakeholdersEmailList") || "[]";
    const emailList: string[] = JSON.parse(emailListString.replace(/'/g, '"'));

    // Send email to each recipient
    const sendPromises = emailList.map((email) =>
      this.emailService.sendEmail(transporter, { ...mailOptions, to: email }),
    );

    await Promise.all(sendPromises);
    console.log("AI consumption report sent successfully.");
  }
}
