import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "@src/modules/common/services/email.service";
import { ExcelEmailService } from "./excel-email.service";
import { BlobStorageService } from "@src/modules/common/services/blobStorage.service";

export enum PaymentEmailType {
  PAYMENT_SUCCESS = "payment_success",
  PAYMENT_FAILED = "payment_failed",
  SUBSCRIPTION_CANCELED = "subscription_canceled",
  SUBSCRIPTION_RESUBSCRIBED = "subscription_resubscribed",
  PLAN_UPGRADED = "plan_upgraded",
  PLAN_DOWNGRADED = "plan_downgraded",
  HUB_DOWNGRADED = "hub_downgraded",
  HUB_DOWNGRADED_REMOVE_USER = "hub_downgrade_remove_user",
  UPCOMING_PAYMENT = "upcoming_payment",
  SUBSCRIPTION_EXPIRED = "subscription_expired",
  PAYMENT_INFO_UPDATED = "payment_info_updated",
  DOWNGRADED_TO_COMMUNITY = "downgraded_to_community",
  TRIAL_EXTENDED = "trial_extended",
  PLAN_ADDED = "plan_added",
}

export interface PaymentEmailData {
  hubId?: string;
  hubName?: string;
  ownerEmail?: string;
  ownerName?: string;
  planName?: string;
  amount?: number;
  currency?: string;
  paymentDate?: Date;
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;
  receiptUrl?: string;
  invoiceId?: string;
  subscriptionId?: string;
  nextPaymentDate?: Date;
  failureReason?: string;
  retryDate?: Date;
  cancelAt?: Date;
  interval?: string;
  previousPlanName?: string;
  cardLast4?: string;
  updatePaymentUrl?: string;
  nameOnCard?: string;
  updatedDate?: string;
  totalSeats?: number;
  usedSeats?: number;
  invitedSeats?: number;
  manageUsersUrl?: string;
  workspaces?: any;
  users?: any;
  sendEmails?: string[];
}

@Injectable()
export class PaymentEmailService {
  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly excelEmailService: ExcelEmailService,
    private readonly blobStorageService: BlobStorageService,
  ) {}

  /**
   * Main method to send payment-related emails based on type
   * @param emailType Type of payment email to send
   * @param data Payment and subscription data
   */
  async sendPaymentEmail(
    emailType: PaymentEmailType,
    data: PaymentEmailData,
  ): Promise<void> {
    try {
      switch (emailType) {
        case PaymentEmailType.PAYMENT_SUCCESS:
          await this.sendPaymentSuccessEmail(data);
          break;
        case PaymentEmailType.PAYMENT_FAILED:
          await this.sendPaymentFailedEmail(data);
          break;
        case PaymentEmailType.SUBSCRIPTION_CANCELED:
          await this.sendSubscriptionCanceledEmail(data);
          break;
        case PaymentEmailType.SUBSCRIPTION_RESUBSCRIBED:
          await this.sendSubscriptionResubscribedEmail(data);
          break;
        case PaymentEmailType.PLAN_UPGRADED:
          await this.sendPlanUpgradedEmail(data);
          break;
        case PaymentEmailType.PLAN_DOWNGRADED:
          await this.sendPlanDowngradedEmail(data);
          break;
        case PaymentEmailType.HUB_DOWNGRADED:
          await this.sendHubDowngradedEmail(data);
          break;
        case PaymentEmailType.HUB_DOWNGRADED_REMOVE_USER:
          await this.sendHubDowngradeRemovedUserEmail(data);
          break;
        case PaymentEmailType.UPCOMING_PAYMENT:
          await this.sendUpcomingPaymentActionRequiredEmail(data);
          break;
        case PaymentEmailType.SUBSCRIPTION_EXPIRED:
          await this.sendSubscriptionExpiredEmail(data);
          break;
        case PaymentEmailType.PAYMENT_INFO_UPDATED:
          await this.sendPaymentInfoUpdatedEmail(data);
          break;
        case PaymentEmailType.DOWNGRADED_TO_COMMUNITY:
          await this.sendDowngradedToCommunityEmail(data);
          break;
        case PaymentEmailType.TRIAL_EXTENDED:
          await this.sendTrialExtendedEmail(data);
          break;
        case PaymentEmailType.PLAN_ADDED:
          await this.sendPlanAddedEmail(data);
          break;
        default:
          console.warn(`Unknown payment email type: ${emailType}`);
      }
    } catch (error) {
      console.error(`Error sending payment email (${emailType}):`, error);
      throw error;
    }
  }

  /**
   * Send payment success email
   */
  private async sendPaymentSuccessEmail(data: PaymentEmailData): Promise<void> {
    if (!data.amount || data.amount === 0) {
      return;
    }
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Payment Successful",
      template: "paymentSuccessEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        planName: data.planName,
        amountPaid: this.formatAmount(data.amount, data.currency),
        paymentDate: this.formatDate(data.paymentDate),
        fromDate: data.billingPeriodStart
          ? this.formatDate(data.billingPeriodStart)
          : "N/A",
        toDate: data.billingPeriodEnd
          ? this.formatDate(data.billingPeriodEnd)
          : "N/A",
        receiptUrl: data.receiptUrl,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Thank You - Your payment for ${data.hubName} is successful`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Send payment failed email
   */
  private async sendPaymentFailedEmail(data: PaymentEmailData): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Payment Failed",
      template: "paymentFailedEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        planName: data.planName,
        amountDue: this.formatAmount(data.amount, data.currency),
        failureDate: this.formatDate(data.paymentDate),
        nextRetryDate: this.formatDate(data.paymentDate, {
          grace_period: true,
        }),
        failureReason: data.failureReason || "Payment could not be processed",
        fixPaymentUrl: data.receiptUrl,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Action Needed: We couldn't process your payment for ${data.hubName}`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Send subscription canceled email
   */
  private async sendSubscriptionCanceledEmail(
    data: PaymentEmailData,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Subscription Canceled",
      template: "subscriptionCanceledEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        planName: data.planName,
        cancellationDate: this.formatDate(data.paymentDate),
        serviceEndDate: data.cancelAt
          ? this.formatDate(data.cancelAt)
          : "Immediately",
        managePlanUrl: `${this.configService.get("admin.baseURL")}/billing/billingOverview/${data.hubId}`,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Your ${data.planName} Plan Has Been Canceled for ${data.hubName}`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Send subscription resubscribed email
   */
  private async sendSubscriptionResubscribedEmail(
    data: PaymentEmailData,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Subscription Resubscribed",
      template: "subscriptionResubscribedEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        planName: data.planName,
        amountPaid: this.formatAmount(data.amount, data.currency),
        resubscriptionDate: this.formatDate(data.paymentDate),
        nextBillingDate: data.nextPaymentDate
          ? this.formatDate(data.nextPaymentDate)
          : "N/A",
        fromDate: data.billingPeriodStart
          ? this.formatDate(data.billingPeriodStart)
          : "N/A",
        toDate: data.billingPeriodEnd
          ? this.formatDate(data.billingPeriodEnd)
          : "N/A",
        interval: data.interval || "month",
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `You're back on board! You've Resubscribed to the ${data.planName} Plan on ${data.hubName}`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Send plan upgraded email
   */
  private async sendPlanUpgradedEmail(data: PaymentEmailData): Promise<void> {
    // Do not send upgrade email if amount is 0 or undefined
    if (!data.amount || data.amount === 0) {
      return;
    }

    const transporter = this.emailService.createTransporter();

    // Get plan-specific features
    const planFeatures = this.getPlanFeatures(data.planName);

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Plan Upgraded",
      template: "planUpgradedEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        previousPlanName: data.previousPlanName || "Community",
        newPlanName: data.planName,
        price: this.formatAmount(data.amount, data.currency),
        upgradeDate: this.formatDate(data.paymentDate),
        nextBillingDate: data.billingPeriodEnd
          ? this.formatDate(data.billingPeriodEnd)
          : "N/A",
        receiptUrl: data.receiptUrl,
        interval: data.interval || "month",
        features: planFeatures,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `You're All Set! ${data.hubName} is now on the ${data.planName} Plan 🎉`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Send plan downgraded email
   */
  private async sendPlanDowngradedEmail(data: PaymentEmailData): Promise<void> {
    const transporter = this.emailService.createTransporter();

    // Get plan-specific features for the new (downgraded) plan
    const planFeatures = this.getPlanFeatures(data.planName);

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Plan Downgraded",
      template: "planDowngradedEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        previousPlanName: data.previousPlanName || "Previous Plan",
        newPlanName: data.planName,
        effectiveDate: data.billingPeriodStart
          ? this.formatDate(data.billingPeriodStart)
          : this.formatDate(data.billingPeriodStart),
        features: planFeatures,
        managePlanUrl: `${this.configService.get("admin.baseURL")}/billing/billingOverview/${data.hubId}`,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Your Plan for ${data.hubName} has been updated to ${data.planName}`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Send hub downgraded email
   */
  private async sendHubDowngradedEmail(data: PaymentEmailData): Promise<void> {
    // Generate Excel buffer
    const excelBuffer =
      await this.excelEmailService.generateDowngradeSummaryExcel(
        data.workspaces,
        data.users,
      );
    // Clean hub name for Azure-friendly file name
    const safeHubName = data.hubName.replace(/[^a-zA-Z0-9-_ ]/g, ""); // Removes quotes, apostrophes, etc.
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const storageName = `Downgrade_Summary_${safeHubName}_${timestamp}`;
    const downloadName = `Downgrade_Summary_${safeHubName}`;
    const mimetype = ".xlsx";
    const blobResult = await this.blobStorageService.uploadExcelBlob(
      excelBuffer,
      storageName,
      downloadName,
      mimetype,
    );
    // Send emails to recipients
    const transporter = this.emailService.createTransporter();
    for (const email of data.sendEmails) {
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: email,
        text: "Hub Downgraded",
        template: "hubDowngradedEmail",
        context: {
          firstName: this.extractFirstName(data.ownerName),
          hubName: data.hubName,
          previousPlanName: data.previousPlanName || "Previous Plan",
          newPlanName: data.planName,
          effectiveDate: this.formatDate(data.billingPeriodStart),
          excelDownloadUrl: blobResult.fileUrl,
          sparrowEmail: this.configService.get("support.sparrowEmail"),
          sparrowWebsite: this.configService.get("support.sparrowWebsite"),
          sparrowWebsiteName: this.configService.get(
            "support.sparrowWebsiteName",
          ),
        },
        subject: `Your Plan for ${data.hubName} has been updated to ${data.planName}`,
      };
      await this.emailService.sendEmail(transporter, mailOptions);
    }
  }

  /**
   * Send a Hub downgrade Email after the user is removed from the Hub
   */
  private async sendHubDowngradeRemovedUserEmail(
    data: PaymentEmailData,
  ): Promise<void> {
    for (let i = 0; i < data.sendEmails.length; i++) {
      const transporter = this.emailService.createTransporter();
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: data.sendEmails[i],
        text: "Hub Downgraded",
        template: "hubDowngradeRemoveUserEmail",
        context: {
          firstName: this.extractFirstName(data.ownerName),
          hubName: data.hubName,
          previousPlanName: data.previousPlanName || "Previous Plan",
          newPlanName: data.planName,
          effectiveDate: data.billingPeriodStart
            ? this.formatDate(data.billingPeriodStart)
            : this.formatDate(data.billingPeriodStart),
          sparrowEmail: this.configService.get("support.sparrowEmail"),
          sparrowWebsite: this.configService.get("support.sparrowWebsite"),
          sparrowWebsiteName: this.configService.get(
            "support.sparrowWebsiteName",
          ),
        },
        subject: `Your Plan for ${data.hubName} has been updated to ${data.planName}`,
      };
      await this.emailService.sendEmail(transporter, mailOptions);
    }
  }

  /**
   * Send upcoming payment action required email
   */
  private async sendUpcomingPaymentActionRequiredEmail(
    data: PaymentEmailData,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    // Calculate days until expiry
    const now = new Date();
    const paymentDate = new Date(data.nextPaymentDate);

    const msPerDay = 1000 * 60 * 60 * 24;
    const expireIn = Math.max(
      0,
      Math.ceil((paymentDate.getTime() - now.getTime()) / msPerDay),
    );

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Action Required - Upcoming Payment",
      template: "upcomingPaymentActionRequiredEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        expireIn,
        billingDate: this.formatDate(data.nextPaymentDate),
        planName: data.planName,
        totalSeats: data.totalSeats || 0,
        usedSeats: data.usedSeats || 0,
        invitedSeats: data.invitedSeats || 0,
        estimatedCharges: this.formatAmount(data.amount, data.currency),
        manageUsersUrl: `${this.configService.get("admin.baseURL")}/hubs/members/${data.hubId}`,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Action Required: Your Sparrow plan will expire in ${expireIn} day${expireIn === 1 ? "" : "s"}`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Send subscription expired email
   */
  private async sendSubscriptionExpiredEmail(
    data: PaymentEmailData,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Subscription Expired",
      template: "subscriptionExpiredEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        planName: data.planName,
        billingUrl: `${this.configService.get("admin.baseURL")}/billing/billingOverview/${data.hubId}`,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Your Sparrow subscription has expired - Action required`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Send downgraded to community email
   */
  private async sendDowngradedToCommunityEmail(
    data: PaymentEmailData,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Hub Downgraded to Community Plan",
      template: "downgradedToCommunityEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        previousPlanName: data.previousPlanName,
        planName: data.planName || "Community Plan",
        billingUrl: `${this.configService.get("admin.baseURL")}/billing/billingOverview/${data.hubId}`,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Your Sparrow hub is being downgraded to the Community Plan`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Send payment info updated email
   */
  private async sendPaymentInfoUpdatedEmail(
    data: PaymentEmailData,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Payment Information Updated",
      template: "paymentInfoUpdatedEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        cardLast4: data.cardLast4 || "****",
        nameOnCard: data.nameOnCard || "N/A",
        updatedDate: data.updatedDate || this.formatDate(new Date()),
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `You've successfully updated your payment details on ${data.hubName}`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Get plan-specific features for display in upgrade/downgrade emails
   */
  private getPlanFeatures(planName: string): string[] {
    const planNameLower = planName.toLowerCase();

    if (planNameLower.includes("community")) {
      return [
        "Up to 5 collaborators",
        "Up to 3 workspaces",
        "Up to 1 Private hub",
        "Unlimited Collections",
        "And more...",
      ];
    } else if (planNameLower.includes("standard")) {
      return [
        "Unlimited collaborators",
        "Up to 5 workspaces",
        "Up to 1 Private hub",
        "Unlimited Collections",
        "And more...",
      ];
    } else if (planNameLower.includes("professional")) {
      return [
        "Unlimited collaborators",
        "Up to 10 workspaces",
        "Up to 1 Private hub",
        "Unlimited Collections",
        "And more...",
      ];
    }

    // Default fallback
    return [
      "Up to 5 collaborators",
      "Up to 3 workspaces",
      "Up to 1 Private hub",
      "Unlimited Collections",
      "And more...",
    ];
  }

  /**
   * Extract first name from full name
   */
  private extractFirstName(fullName: string): string {
    return fullName?.split(" ")[0] || "User";
  }

  /**
   * Format amount with currency
   */
  private formatAmount(amount: number, currency: string): string {
    const formattedAmount = (amount / 100).toFixed(2); // Convert from cents
    return currency.toUpperCase() === "USD"
      ? formattedAmount
      : `${formattedAmount} ${currency.toUpperCase()}`;
  }

  /**
   * Format date for display, with optional grace period (+3 days)
   */
  private formatDate(
    date: Date | number,
    options?: { grace_period?: boolean },
  ): string {
    const d = typeof date === "number" ? new Date(date * 1000) : new Date(date);

    if (options?.grace_period) {
      d.setDate(d.getDate() + 3);
    }

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  private async sendTrialExtendedEmail(data: PaymentEmailData): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Trial Extended",
      template: "trialExtendedEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        planName: data.planName,
        newTrialEndDate: this.formatDate(data.billingPeriodEnd),
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
      },
      subject: `Your trial for ${data.hubName} has been extended`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  private async sendPlanAddedEmail(data: PaymentEmailData): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Plan Updated",
      template: "planAddedEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        planName: data.planName,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
      },
      subject: `Your hub ${data.hubName} has been upgraded to ${data.planName}`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }
}
