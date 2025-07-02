import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "@src/modules/common/services/email.service";

export enum PaymentEmailType {
  PAYMENT_SUCCESS = "payment_success",
  PAYMENT_FAILED = "payment_failed",
  SUBSCRIPTION_CANCELED = "subscription_canceled",
  SUBSCRIPTION_RESUBSCRIBED = "subscription_resubscribed",
  PLAN_UPGRADED = "plan_upgraded",
  PLAN_DOWNGRADED = "plan_downgraded",
  UPCOMING_PAYMENT = "upcoming_payment",
  PAYMENT_INFO_UPDATED = "payment_info_updated",
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
}

@Injectable()
export class PaymentEmailService {
  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
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
        case PaymentEmailType.UPCOMING_PAYMENT:
          await this.sendUpcomingPaymentEmail(data);
          break;
        case PaymentEmailType.PAYMENT_INFO_UPDATED:
          await this.sendPaymentInfoUpdatedEmail(data);
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
        receiptUrl: data.receiptUrl,
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
        managePlanUrl: `${this.configService.get("app.frontendUrl")}/billing/${data.hubId}`,
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
   * Send upcoming payment email
   */
  private async sendUpcomingPaymentEmail(
    data: PaymentEmailData,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: data.ownerEmail,
      text: "Upcoming Payment Reminder",
      template: "upcomingPaymentEmail",
      context: {
        firstName: this.extractFirstName(data.ownerName),
        hubName: data.hubName,
        planName: data.planName,
        billingAmount: this.formatAmount(data.amount, data.currency),
        billingDate: this.formatDate(data.nextPaymentDate),
        cardLast4: data.cardLast4 || "****",
        updatePaymentUrl:
          data.updatePaymentUrl ||
          `${this.configService.get("app.frontendUrl")}/billing/${data.hubId}`,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Gentle Just a heads-up: Your upcoming payment for ${data.hubName}`,
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

  //***********helper functions

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
   * Format date for display
   */
  private formatDate(date: Date | number): string {
    const d = typeof date === "number" ? new Date(date * 1000) : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}
