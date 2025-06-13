import { DynamicModule, Module, Provider } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { StripeController } from "./controllers/stripe.controller";
import { PaymentMethodsController } from "./controllers/payment-methods.controller";
import { StripeSubscriptionRepository } from "./repositories/stripe-subscription.repository";
import { StripeSubscriptionService } from "./services/stripe-subscription.service";
import { StripeWebhookGateway } from "./gateways/stripe-webhook.gateway";

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
      StripeSubscriptionService,
      StripeWebhookGateway,
    ];
    const controllers = [];
    const exports: Provider[] = [];

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
