import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Inject,
  Optional,
  HttpException,
  HttpStatus,
  UseGuards,
  Put,
  Delete,
  Headers,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import {
  CreateCustomerDto,
  CustomerResponseDto,
  SetupIntentDto,
  SetupIntentResponseDto,
  PublicKeyResponseDto,
  CreateSubscriptionDto,
  SubscriptionResponseDto,
  UpdateSubscriptionDto,
  WebhookEventDto,
  CancelSubscriptionDto,
  ReactivateSubscriptionDto,
} from "../payloads/stripe.payload";
import { StripeSubscriptionService } from "../services/stripe-subscription.service";
import {
  StripeWebhookGateway,
  PaymentEventType,
} from "../gateways/stripe-webhook.gateway";
import { StripeSubscriptionRepository } from "../repositories/stripe-subscription.repository";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";

// Dynamically import Stripe services
let StripeService: any;
try {
  const stripeBilling = require("@sparrowapp-dev/stripe-billing");
  StripeService = stripeBilling.StripeService;
} catch (error) {
  console.warn("Stripe service not available");
}

@ApiTags("stripe")
@Controller("api/stripe")
export class StripeController {
  private isStripeAvailable: boolean;

  constructor(
    @Optional() @Inject(StripeService) private readonly stripeService: any,
    private readonly stripeSubscriptionService: StripeSubscriptionService,
    private readonly stripeWebhookGateway: StripeWebhookGateway,
    private readonly stripeSubscriptionRepo: StripeSubscriptionRepository,
  ) {
    this.isStripeAvailable = !!this.stripeService;

    if (!this.isStripeAvailable) {
      console.warn(
        "Stripe service is not available. Endpoints will be disabled.",
      );
    }
  }

  private checkStripeAvailability() {
    if (!this.isStripeAvailable) {
      throw new HttpException(
        "Stripe features are not available",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Get("config")
  @ApiOperation({
    summary: "Get Stripe public key for frontend initialization",
  })
  @ApiResponse({
    status: 200,
    description: "Returns the Stripe publishable key",
    type: PublicKeyResponseDto,
  })
  getConfig(): PublicKeyResponseDto {
    try {
      this.checkStripeAvailability();
      return {
        publishableKey: this.stripeService.getPublicKey(),
      };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to get publishable key",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Post("customers")
  @ApiOperation({ summary: "Create a new Stripe customer" })
  @ApiResponse({
    status: 201,
    description: "Customer created successfully",
    type: CustomerResponseDto,
  })
  async createCustomer(
    @Body() createCustomerDto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    try {
      this.checkStripeAvailability();

      const customer = await this.stripeService.createCustomer(
        createCustomerDto.email,
        createCustomerDto.metadata,
      );

      return { customer };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to create customer",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Get("customers/:id")
  @ApiOperation({ summary: "Get a Stripe customer by ID" })
  @ApiParam({
    name: "id",
    description: "Stripe customer ID",
    example: "cus_12345",
  })
  @ApiResponse({
    status: 200,
    description: "Returns the Stripe customer",
    type: CustomerResponseDto,
  })
  @ApiResponse({ status: 404, description: "Customer not found" })
  async getCustomer(
    @Param("id") customerId: string,
  ): Promise<CustomerResponseDto> {
    try {
      this.checkStripeAvailability();

      const customer = await this.stripeService.getCustomer(customerId);
      return { customer };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to get customer",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Post("setup-intents")
  @ApiOperation({
    summary: "Create a setup intent for adding a payment method",
    description:
      "Creates a SetupIntent that will be used with Stripe Elements to securely collect payment method details",
  })
  @ApiResponse({
    status: 201,
    description: "Setup intent created successfully",
    type: SetupIntentResponseDto,
  })
  async createSetupIntent(
    @Body() setupIntentDto: SetupIntentDto,
  ): Promise<SetupIntentResponseDto> {
    try {
      this.checkStripeAvailability();

      const setupIntent = await this.stripeService.createSetupIntent(
        setupIntentDto.customerId,
      );

      return {
        clientSecret: setupIntent.client_secret,
      };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to create setup intent",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Post("subscriptions")
  @ApiOperation({ summary: "Create a new subscription for a customer" })
  @ApiBody({ type: CreateSubscriptionDto })
  @ApiResponse({
    status: 201,
    description: "Subscription created successfully",
    type: SubscriptionResponseDto,
  })
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    try {
      this.checkStripeAvailability();

      const subscription = await this.stripeService.createSubscription(
        createSubscriptionDto.customerId,
        createSubscriptionDto.priceId,
        createSubscriptionDto.paymentMethodId,
        createSubscriptionDto.metadata,
      );

      return subscription;
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to create subscription",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Get("subscriptions/:id")
  @ApiOperation({ summary: "Get a subscription by ID" })
  @ApiParam({
    name: "id",
    description: "Stripe subscription ID",
    example: "sub_12345",
  })
  @ApiResponse({
    status: 200,
    description: "Returns the subscription details",
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Subscription not found" })
  async getSubscription(
    @Param("id") subscriptionId: string,
  ): Promise<SubscriptionResponseDto> {
    try {
      this.checkStripeAvailability();

      const subscription =
        await this.stripeService.getSubscription(subscriptionId);
      return { subscription };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to get subscription",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Get("subscriptions/customer/:customerId")
  @ApiOperation({ summary: "Get all subscriptions for a customer" })
  @ApiParam({
    name: "customerId",
    description: "Stripe customer ID",
    example: "cus_12345",
  })
  @ApiResponse({
    status: 200,
    description: "Returns all subscriptions for the customer",
    type: [SubscriptionResponseDto],
  })
  async getCustomerSubscriptions(
    @Param("customerId") customerId: string,
  ): Promise<{ subscriptions: any[] }> {
    try {
      this.checkStripeAvailability();

      const subscriptions =
        await this.stripeService.getCustomerSubscriptions(customerId);
      return { subscriptions };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to get customer subscriptions",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Put("subscriptions/:id")
  @ApiOperation({
    summary: "Update a subscription",
    description:
      "Updates a subscription by changing the price (plan) or other attributes",
  })
  @ApiParam({
    name: "id",
    description: "Stripe subscription ID",
    example: "sub_12345",
  })
  @ApiBody({ type: UpdateSubscriptionDto })
  @ApiResponse({
    status: 200,
    description: "Subscription updated successfully",
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Subscription not found" })
  async updateSubscription(
    @Param("id") subscriptionId: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    try {
      this.checkStripeAvailability();

      const subscription = await this.stripeService.updateSubscription(
        subscriptionId,
        updateSubscriptionDto.priceId,
        updateSubscriptionDto.metadata,
        updateSubscriptionDto.paymentMethodId,
      );

      return subscription;
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to update subscription",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Delete("subscriptions/:id")
  @ApiOperation({
    summary: "Cancel a subscription",
    description:
      "Cancels a subscription at period end or immediately based on the provided options",
  })
  @ApiParam({
    name: "id",
    description: "Stripe subscription ID",
    example: "sub_12345",
  })
  @ApiBody({ type: CancelSubscriptionDto })
  @ApiResponse({
    status: 200,
    description: "Subscription cancelled successfully",
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Subscription not found" })
  async cancelSubscription(
    @Param("id") subscriptionId: string,
    @Body() cancelSubscriptionDto: CancelSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    try {
      this.checkStripeAvailability();

      const subscription = await this.stripeService.cancelSubscription(
        subscriptionId,
        cancelSubscriptionDto.cancelImmediately || false,
      );

      return { subscription };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to cancel subscription",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Post("subscriptions/:id/reactivate")
  @ApiOperation({
    summary: "Reactivate a cancelled subscription",
    description:
      "Reactivates a subscription that was previously cancelled but is still within the current billing period",
  })
  @ApiParam({
    name: "id",
    description: "Stripe subscription ID",
    example: "sub_12345",
  })
  @ApiBody({ type: ReactivateSubscriptionDto })
  @ApiResponse({
    status: 200,
    description: "Subscription reactivated successfully",
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Subscription not found" })
  @ApiResponse({
    status: 400,
    description: "Subscription cannot be reactivated",
  })
  async reactivateSubscription(
    @Param("id") subscriptionId: string,
    @Body() reactivateDto: ReactivateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    try {
      this.checkStripeAvailability();

      const subscription = await this.stripeService.reactivateSubscription(
        subscriptionId,
        reactivateDto.metadata,
      );

      return { subscription };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to reactivate subscription",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Get("plans")
  @ApiOperation({ summary: "Get all available subscription plans/prices" })
  @ApiResponse({
    status: 200,
    description: "Returns all active subscription plans",
  })
  async getPlans(): Promise<{ plans: any[] }> {
    try {
      this.checkStripeAvailability();

      const plans = await this.stripeService.getPlans();
      return { plans };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to get plans",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Get("invoices/customer/:customerId")
  @ApiOperation({ summary: "Get all invoices for a customer" })
  @ApiParam({
    name: "customerId",
    description: "Stripe customer ID",
    example: "cus_12345",
  })
  @ApiResponse({
    status: 200,
    description: "Returns all invoices for the customer",
  })
  async getCustomerInvoices(
    @Param("customerId") customerId: string,
    @Res() res: FastifyReply,
  ): Promise<{ invoices: any[] }> {
    try {
      this.checkStripeAvailability();

      const invoices =
        await this.stripeService.getCustomerInvoicesDetailed(customerId);

      const responseData = new ApiResponseService(
        "Invoice's Fetched",
        HttpStatusCode.OK,
        invoices,
      );

      return res.status(HttpStatusCode.OK).send(responseData);
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to get customer invoices",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("webhooks")
  @ApiOperation({
    summary: "Handle Stripe webhook events",
    description:
      "Processes Stripe webhook events such as subscription updates, payment successes/failures, etc.",
  })
  @ApiResponse({
    status: 200,
    description: "Webhook event processed successfully",
  })
  async handleWebhook(
    @Req() request: any,
    @Headers("stripe-signature") signature: string,
  ): Promise<{ received: boolean }> {
    try {
      const rawBody = request.rawBody;
      const event = await this.stripeService.constructEventFromPayload(
        rawBody,
        signature,
      );

      // Handle different types of events
      switch (event.type) {
        case "customer.subscription.created":
          await this.stripeSubscriptionService.handleSubscriptionCreated(
            event.data.object,
          );
          // Get the updated team data to send to client
          const teamCreated = await this.stripeSubscriptionRepo.findTeamById(
            event.data.object.metadata?.hubId,
          );

          this.stripeWebhookGateway.emitPaymentEvent(
            PaymentEventType.SUBSCRIPTION_CREATED,
            {
              subscription: event.data.object,
              team: teamCreated,
            },
          );
          break;

        case "customer.subscription.updated":
          await this.stripeSubscriptionService.handleSubscriptionUpdated(
            event.data.object,
          );
          // Get the updated team data
          const teamUpdated = await this.stripeSubscriptionRepo.findTeamById(
            event.data.object.metadata?.hubId,
          );

          this.stripeWebhookGateway.emitPaymentEvent(
            PaymentEventType.SUBSCRIPTION_UPDATED,
            {
              subscription: event.data.object,
              team: teamUpdated,
            },
          );
          break;

        case "invoice.payment_failed":
          await this.stripeSubscriptionService.handleInvoicePaymentFailed(
            event.data.object,
          );
          // Get team data for the failed payment
          const teamWithFailedPayment =
            await this.stripeSubscriptionRepo.findTeamById(
              event.data.object.parent?.subscription_details?.metadata?.hubId,
            );

          this.stripeWebhookGateway.emitPaymentEvent(
            PaymentEventType.PAYMENT_FAILED,
            {
              invoice: event.data.object,
              team: teamWithFailedPayment,
            },
          );
          break;

        case "invoice.payment_succeeded":
          await this.stripeSubscriptionService.handleInvoicePaymentSucceeded(
            event.data.object,
          );
          // Get team data for the successful payment
          const teamWithSuccessfulPayment =
            await this.stripeSubscriptionRepo.findTeamById(
              event.data.object.parent?.subscription_details?.metadata?.hubId,
            );

          this.stripeWebhookGateway.emitPaymentEvent(
            PaymentEventType.PAYMENT_SUCCESS,
            {
              invoice: event.data.object,
              team: teamWithSuccessfulPayment,
            },
          );
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error("Webhook error:", error);
      throw new HttpException(
        "Webhook error: " + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
