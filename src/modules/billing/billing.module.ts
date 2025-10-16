import { DynamicModule, Module, Provider } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { StripeController } from "./controllers/stripe.controller";
import { PaymentMethodsController } from "./controllers/payment-methods.controller";
import { StripeSubscriptionRepository } from "./repositories/stripe-subscription.repository";
import { BillingAuditRepository } from "./repositories/billing-audit.repository";
import { PromoCodeRepository } from "./repositories/promocode.repository";
import { StripeSubscriptionService } from "./services/stripe-subscription.service";
import { StripeWebhookGateway } from "./gateways/stripe-webhook.gateway";
import { StripeSchedulerService } from "./services/stripe-scheduler.service";
import { BillingAuditService } from "./services/billing-audit.service";
import { PromoCodeService } from "./services/promocode.service";
import { PaymentEmailService } from "./services/payment-email.service";
import { PaymentEmailHelper } from "./helpers/payment-email.helper";
import { StripeWebhookHelper } from "./helpers/stripe-webhook.helper";
import { StripeCustomerService } from "./services/stripe-customer.service";
import { LicenseManagementService } from "./services/license-management.service";
import { EmailService } from "@src/modules/common/services/email.service";
import { AdminHubsRepository } from "@src/modules/user-admin/repositories/user-admin.hubs.repository";
import { TeamRepository } from "@src/modules/identity/repositories/team.repository";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import { PricingService } from "@src/modules/workspace/services/pricing.repository";
import { PricingRepository } from "@src/modules/workspace/repositories/pricing.repository";
import { SalesEmailRepository } from "../workspace/repositories/sales-email.repository";
import { DownGradeTeamRepository } from "./repositories/downgradeTeam.repository";
import { DownGradeUserRepository } from "./repositories/downgradeUser.repository";
import { DownGradeWorkspaceRepository } from "./repositories/downgradeWorkspace.repository";
import { DownGradeService } from "./services/downgrade.service";
import { ExcelEmailService } from "./services/excel-email.service";

// Try to import the Stripe module, but don't crash if it's not available
let StripeModule: any;
let StripeService: any;
let PaymentMethodsService: any;
try {
  const stripeBilling = require("@sparrowapp-dev/stripe-billing");
  StripeModule = stripeBilling.StripeModule;
  StripeService = stripeBilling.StripeService;
  PaymentMethodsService = stripeBilling.PaymentMethodsService;
} catch (error) {
  console.warn(
    "Stripe billing module not available. Billing features will be disabled.",
  );
}

@Module({})
export class BillingModule {
  static register(options?: any): DynamicModule {
    const imports = [ConfigModule.forRoot({ isGlobal: true })];

    const providers: Provider[] = [
      StripeSubscriptionRepository,
      BillingAuditRepository,
      PromoCodeRepository,
      PricingRepository,
      DownGradeTeamRepository,
      DownGradeUserRepository,
      DownGradeWorkspaceRepository,
      DownGradeService,
      ExcelEmailService,
      BillingAuditService,
      PromoCodeService,
      PricingService,
      StripeSubscriptionService,
      StripeWebhookGateway,
      StripeSchedulerService,
      StripeWebhookHelper,
      PaymentEmailService,
      PaymentEmailHelper,
      StripeCustomerService,
      LicenseManagementService,
      TeamRepository,
      UserRepository,
      EmailService,
      AdminHubsRepository,
      SalesEmailRepository,
    ];

    const controllers = [];
    const exports: Provider[] = [
      StripeSubscriptionService,
      StripeSubscriptionRepository,
      BillingAuditRepository,
      BillingAuditService,
      PromoCodeService,
      DownGradeTeamRepository,
      DownGradeUserRepository,
      DownGradeWorkspaceRepository,
      DownGradeService,
      ExcelEmailService,
      PricingService,
      PaymentEmailService,
      PaymentEmailHelper,
      StripeCustomerService,
      LicenseManagementService,
      BillingAuditService,
      ...(StripeModule ? [StripeModule] : []),
    ];

    // Only add Stripe if the module was successfully imported
    if (StripeModule) {
      imports.push(
        StripeModule.register({
          secretKey: process.env.STRIPE_SECRET_KEY,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
          webhookSecret: process.env.STRIPE_WEBHOOK,
          isGlobal: false,
          registerControllers: false,
        }),
      );

      controllers.push(StripeController, PaymentMethodsController);
    }

    return {
      module: BillingModule,
      imports,
      controllers,
      providers,
      exports,
    };
  }
}
