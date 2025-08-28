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
  CancelSubscriptionDto,
  ReactivateSubscriptionDto,
} from "../payloads/stripe.payload";
import { StripeWebhookHelper } from "../helpers/stripe-webhook.helper";
import { PromoCodeService } from "../services/promocode.service";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import { SalesEmailRepository } from "@src/modules/workspace/repositories/sales-email.repository";
import { PricingService } from "@src/modules/workspace/services/pricing.repository";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { ExtendedFastifyRequest } from "@src/types/fastify";
import { ConfigService } from "@nestjs/config";
import { TrialType } from "@src/modules/common/enum/trial.enum";

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
    private readonly stripeWebhookHelper: StripeWebhookHelper,
    private readonly promoCodeService: PromoCodeService,
    private readonly userRepository: UserRepository,
    private readonly pricingService: PricingService,
    private readonly configService: ConfigService,
    private readonly salesEmailRepository: SalesEmailRepository,
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
        createCustomerDto.name,
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
    @Req() req: any,
  ): Promise<SubscriptionResponseDto> {
    try {
      this.checkStripeAvailability();
      const currentUser = req.user;
      const userRecord = await this.userRepository.getUserByEmail(
        currentUser.email,
      );
      if (!userRecord) {
        throw new HttpException("User does not exist", HttpStatus.BAD_REQUEST);
      }
      const isTrialExhausted = userRecord.isUserTrialExhausted;
      if (isTrialExhausted) {
        throw new HttpException(
          "User trial has already been exhausted.",
          HttpStatus.BAD_REQUEST,
        );
      }

      const salesEmailRecord =
        await this.salesEmailRepository.getSalesEmailRecordByCustomerEmail(
          currentUser.email,
        );
      const salesTrialDays = salesEmailRecord.trialPeriod;
      const configuredTrialDays =
        this.configService.get<number>("trial.trialPeriod");
      if (createSubscriptionDto.trialType === TrialType.STANDARD) {
        createSubscriptionDto.trialPeriodDays = configuredTrialDays;
      } else {
        createSubscriptionDto.trialPeriodDays = salesTrialDays;
      }
      // Validate promo code before creating subscription if provided
      if (createSubscriptionDto.promoCodeId) {
        // Find promo code to get the actual code for validation
        const promoCodeFromDb =
          await this.promoCodeService.findByStripePromoCodeId(
            createSubscriptionDto.promoCodeId,
          );

        if (!promoCodeFromDb) {
          throw new HttpException(
            "Invalid promo code. Please enter a valid promo code.",
            HttpStatus.BAD_REQUEST,
          );
        }

        // Validate the promo code
        const validation = await this.promoCodeService.validatePromoCode(
          promoCodeFromDb.code,
          createSubscriptionDto.priceId,
        );

        if (validation.error) {
          throw new HttpException(validation.message, HttpStatus.BAD_REQUEST);
        }
      }

      const subscription = await this.stripeService.createSubscription(
        createSubscriptionDto.customerId,
        createSubscriptionDto.priceId,
        createSubscriptionDto.paymentMethodId,
        createSubscriptionDto.metadata,
        createSubscriptionDto.trialPeriodDays,
        createSubscriptionDto.seats,
        createSubscriptionDto.promoCodeId
          ? { id: createSubscriptionDto.promoCodeId }
          : undefined,
      );

      // If promo code was applied and subscription was successful, update user and promo code
      if (subscription && createSubscriptionDto.promoCodeId) {
        const userId = req.user?._id;

        if (userId) {
          // Find the promo code to get its details
          const promoCode = await this.promoCodeService.findByStripePromoCodeId(
            createSubscriptionDto.promoCodeId,
          );

          if (promoCode) {
            // Add applied promo code to user
            await this.userRepository.addAppliedPromoCode(userId, {
              id: promoCode._id!,
              code: promoCode.code,
              used_on: new Date(),
            });
          }
        }
      }

      return subscription;
    } catch (error) {
      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error.message || "Failed to create subscription",
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
      "Updates a subscription by changing the price (plan) or other attributes. Supports immediate upgrades and end-of-cycle downgrades.",
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
        updateSubscriptionDto.prorationBehavior,
        updateSubscriptionDto.atPeriodEnd,
        updateSubscriptionDto.seats,
        updateSubscriptionDto.paymentBehavior,
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
        false, //disables cancellation at mid cycle
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin")
  @Post("promo-codes")
  async createPromoCode(
    @Body()
    createPromoCodeDto: {
      code: string;
      type: "percentage" | "amount";
      value: number;
      applicableProducts: string[];
      startDate?: string;
      endDate?: string;
      maxRedemptions?: number;
      billingCycle: number;
      allowedUsers?: string[];
    },
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ): Promise<{
    success: boolean;
    promoCode?: any;
    coupon?: any;
    error?: string;
  }> {
    try {
      this.checkStripeAvailability();

      // Validate applicable products if provided
      if (
        createPromoCodeDto.applicableProducts &&
        createPromoCodeDto.applicableProducts.length > 0
      ) {
        const priceValidation = await this.pricingService.validatePriceIds(
          createPromoCodeDto.applicableProducts,
        );
        if (!priceValidation.valid) {
          throw new HttpException(
            `Invalid price IDs: ${priceValidation.invalidPriceIds.join(", ")}. Please provide valid price IDs for applicable products.`,
            HttpStatus.BAD_REQUEST,
          );
        }
      } else {
        throw new HttpException(
          "Please provide valid price IDs for applicable products.",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate discount amount for "amount" type coupons
      if (createPromoCodeDto.type === "amount") {
        const discountValidation =
          await this.pricingService.validateDiscountAmount(
            createPromoCodeDto.value,
            createPromoCodeDto.applicableProducts || [],
          );

        if (!discountValidation.valid) {
          throw new HttpException(
            discountValidation.errors.join("; "),
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const params = {
        ...createPromoCodeDto,
        startDate: createPromoCodeDto.startDate
          ? new Date(createPromoCodeDto.startDate)
          : undefined,
        endDate: createPromoCodeDto.endDate
          ? new Date(createPromoCodeDto.endDate)
          : undefined,
      };

      const result = await this.stripeService.createPromoCode(params);

      if (!result.success) {
        throw new HttpException(
          result.error || "Failed to create promo code",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Save promo code to database
      const userEmail = request.user?.email || null;
      await this.promoCodeService.createPromoCode(result.promoCode, userEmail);

      const responseData = new ApiResponseService(
        "Promo Code Created",
        HttpStatusCode.OK,
        {
          promoCode: result.promoCode,
        },
      );
      return res.status(HttpStatusCode.OK).send(responseData);
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to create promo code",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Post("promo-codes/validate")
  async validatePromoCode(
    @Body()
    validateDto: {
      promocode: string;
      priceId: string;
    },
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ): Promise<void> {
    const userEmail = request.user?.email || null;
    try {
      const validation = await this.promoCodeService.validatePromoCode(
        validateDto.promocode,
        validateDto.priceId,
        userEmail,
      );

      const responseData = {
        statusCode: HttpStatusCode.OK,
        message: validation.message,
        is_error: validation.error,
        data: {
          promo_id: validation?.promo_id || null,
          type: validation?.type || null,
          value: validation?.value || null,
          billing_cycles: Number(validation?.billing_cycles) || null,
        },
      };

      return res.status(HttpStatusCode.OK).send(responseData);
    } catch (error) {
      const errorResponse = {
        statusCode: HttpStatusCode.OK,
        message: "Invalid promo code. Please enter a valid promo code.",
        error: true,
      };
      return res.status(HttpStatusCode.OK).send(errorResponse);
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

      // Delegate webhook processing to the helper
      await this.stripeWebhookHelper.processWebhookEvent(event);

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
