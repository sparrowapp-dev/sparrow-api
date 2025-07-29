import { BadRequestException, Injectable } from "@nestjs/common";
import { InsertOneResult, WithId } from "mongodb";

// ---- Repository
import { SendSalesEmail } from "../payloads/sales-email.payload";
import { SalesEmailRepository } from "../repositories/sales-email.repository";
import { SalesEmail } from "@src/modules/common/models/sales-email.model";
import { EmailService } from "@src/modules/common/services/email.service";
import { ConfigService } from "@nestjs/config";
import { TeamService } from "@src/modules/identity/services/team.service";
import { PricingService } from "./pricing.repository";

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
    private readonly teamService: TeamService,
    private readonly pricingService: PricingService,
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

  async formatDate(date: Date): Promise<string> {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  async sendTrialConfirmationEmail(
    id: string,
    payload: { userCount: number },
  ): Promise<void> {
    const data = await this.salesEmailRepository.getSalesEmailRecordById(id);
    if (!data) {
      throw new BadRequestException("Record not found");
    }
    const team = await this.teamService.get(data.createdHubId);
    // Calculate start and end dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + (data.trialPeriod || 0));

    const formattedStartDate = await this.formatDate(startDate);
    const formattedEndDate = await this.formatDate(endDate);
    const amount = 9.99 * payload.userCount;
    const user = team.users.find((u) => u.role === "owner");
    await this.teamService.updateHubTrialAndPlan(
      team._id.toString(),
      data.inviteCount,
    );

    const transporter = this.emailService.createTransporter();
    const baseURL = this.configService.get("admin.baseURL");
    const hubUrl = `${baseURL}/hubs/workspace/${team._id.toString()}`;
    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: user.email,
      text: "Trial Confirmation Email",
      template: "salesTrialEmail2",
      context: {
        userName: user.name,
        hubName: team.name,
        userCount: payload.userCount,
        trialStart: formattedStartDate,
        trialEnd: formattedEndDate,
        amount: `$${amount.toFixed(2)}/month`,
        hubUrl: hubUrl,
        trailFlow: "Standard",
      },
      subject: `Trial Confirmation email for ${team.name} Hub`,
    };
    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }

  async sendUserTrialConfirmationEmail(
    hubId: string,
    trialFlow: string,
    trialFrequency: string,
    promoDiscountType: string,
    promoDiscountValue: number,
  ): Promise<void> {
    const team: any = await this.teamService.get(hubId);
    const pricingDetails = await this.pricingService.getpricingDetails();
    // Calculate start and end dates
    const startDate = team?.billing?.current_period_start || new Date();
    const endDate = team?.billing?.current_period_end;
    if (!endDate) {
      endDate.setDate(startDate.getDate() + 14);
    }

    const formattedStartDate = await this.formatDate(startDate);
    const formattedEndDate = await this.formatDate(endDate);
    const plan = pricingDetails.plans.find(
      (p) => p.tier.toLowerCase() === trialFlow.toLowerCase(),
    );

    let price = 0;
    if (plan) {
      const billingOption = plan.billing.find(
        (b) => b.interval.toLowerCase() === trialFrequency.toLowerCase(),
      );
      if (billingOption) {
        price = billingOption.price * team.users.length;
      }
    }
    const invitedUserCount = team?.invites ? team.invites.length : 0;
    let amount = price * (team.users.length + invitedUserCount);
    if (promoDiscountType && promoDiscountValue) {
      if (promoDiscountType === "percentage") {
        const discountAmount = (amount * promoDiscountValue) / 100;
        amount -= discountAmount;
      } else if (promoDiscountType === "amount") {
        amount -= promoDiscountValue;
      }
    }
    // amount = Math.floor(amount * 100) / 100;
    const user = team.users.find((u: any) => u.role === "owner");
    await this.teamService.updateHubTrialAndPlan(team._id.toString());

    const capitalizedFlow = trialFlow
      ? trialFlow.charAt(0).toUpperCase() + trialFlow.slice(1)
      : "";
    const transporter = this.emailService.createTransporter();
    const baseURL = this.configService.get("admin.baseURL");
    const hubUrl = `${baseURL}/hubs/workspace/${team._id.toString()}`;
    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: user.email,
      text: "Trial Confirmation Email",
      template: "salesTrialEmail2",
      context: {
        userName: user.name,
        hubName: team.name,
        userCount: team.users.length + invitedUserCount,
        trialStart: formattedStartDate,
        trialEnd: formattedEndDate,
        amount: `$${amount.toFixed(2)}/${trialFrequency.toLowerCase() === "monthly" ? "month" : "year"}`,
        hubUrl: hubUrl,
        trialFlow: capitalizedFlow,
      },
      subject: `Trial Confirmation email for ${team.name} Hub`,
    };
    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }
}
