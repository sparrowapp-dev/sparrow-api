import { BadRequestException, Injectable } from "@nestjs/common";
import { InsertOneResult, WithId } from "mongodb";

// ---- Repository
import { SendSalesEmail } from "../payloads/sales-email.payload";
import { SalesEmailRepository } from "../repositories/sales-email.repository";
import { SalesEmail } from "@src/modules/common/models/sales-email.model";
import { EmailService } from "@src/modules/common/services/email.service";
import { ConfigService } from "@nestjs/config";

/**
 * Sales Email Service
 * This class handles business logic for managing sales email records,
 * including adding, retrieving, updating, and deleting sales email records.
 */

@Injectable()
export class SalesEmailService {
  constructor(
    private readonly salesEmailRepository: SalesEmailRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Adds a new sales record and send the email to customer.
   *
   * @param sendSalesEmailDto - The data transfer object containing the sales mail details.
   * @returns The result of the insert operation.
   * @throws BadRequestException if a feature with the same name already exists.
   */
  async addSalesEmailRecord(
    sendSalesEmailDto: SendSalesEmail,
  ): Promise<InsertOneResult<SalesEmail>> {
    // Hardcoded admin key for comparison
    const ADMIN_KEY = this.configService.get("sparrowAdmin.adminKey");

    if (
      !sendSalesEmailDto?.adminKey ||
      sendSalesEmailDto.adminKey !== ADMIN_KEY
    ) {
      throw new BadRequestException("Invalid Admin key");
    }
    const existingRecord =
      await this.salesEmailRepository.getSalesEmailRecordByCustomerEmail(
        sendSalesEmailDto.customerEmail,
      );
    if (existingRecord) {
      throw new BadRequestException("Sales email already sent for this email");
    }

    const emailRecord: SalesEmail = {
      customerEmail: sendSalesEmailDto.customerEmail,
      description: sendSalesEmailDto?.description ?? "",
      companyName: sendSalesEmailDto?.companyName ?? "",
      trialPeriod: sendSalesEmailDto?.trialPeriod ?? 0,
      trialPlan: sendSalesEmailDto?.trialPlan ?? "",
      customerFirstName: sendSalesEmailDto?.customerFirstName ?? "",
      isHubCreated: false,
      inviteCount: sendSalesEmailDto.inviteCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const transporter = this.emailService.createTransporter();
    const baseURL = this.configService.get("auth.baseURL");
    const flow =
      sendSalesEmailDto?.trialPlan === "STANDARD"
        ? "trial_standard"
        : sendSalesEmailDto?.trialPlan;

    const record =
      await this.salesEmailRepository.addSalesEmailData(emailRecord);

    const trialPeriod = Math.round(sendSalesEmailDto.trialPeriod / 30);

    const startTrialUrl = `${baseURL}/init?flow=${flow}&trialId=${record.insertedId.toString()}&email=${encodeURIComponent(emailRecord.customerEmail)}`;
    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: sendSalesEmailDto.customerEmail,
      text: "Promote Member Email",
      template: "salesTrialEmail",
      context: {
        userName: sendSalesEmailDto.customerFirstName,
        userEmail: sendSalesEmailDto.customerEmail,
        inviteCount: sendSalesEmailDto.inviteCount.toString(),
        startTrialUrl: startTrialUrl,
        trialPeriod: trialPeriod.toString(),
      },
      subject: `Trial Active email for ${sendSalesEmailDto.companyName}`,
    };

    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
    return record;
  }

  /**
   * Retrieves a email record by its ID.
   *
   * @param id - ID of the record.
   * @returns The record with the specified id.
   * @throws BadRequestException if the record is not found.
   */
  async getSalesEmailRecord(id: string): Promise<WithId<SalesEmail>> {
    const data = await this.salesEmailRepository.getSalesEmailRecordById(id);
    if (!data) {
      throw new BadRequestException("Record not found");
    }
    return data;
  }

  async updateSalesEmailRecord(
    id: string,
    updateData: Partial<SalesEmail>,
  ): Promise<WithId<SalesEmail>> {
    const data = await this.salesEmailRepository.updateSalesEmailRecord(
      id,
      updateData,
    );
    if (!data) {
      throw new BadRequestException("Record not found");
    }
    return data;
  }
}
