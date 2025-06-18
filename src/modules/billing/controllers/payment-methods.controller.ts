import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Inject,
  Optional,
  HttpException,
  HttpStatus,
  UseGuards,
  Post,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { RolesGuard } from "@src/modules/common/guards/roles.guard";
import { Roles } from "@src/modules/common/decorators/roles.decorators";
import {
  UpdateBillingDetailsDto,
  PaymentMethodsResponseDto,
  PaymentMethodResponseDto,
  DeletePaymentMethodResponseDto,
  PaymentMethodDto,
  SetDefaultPaymentMethodDto,
} from "../payloads/payment-methods.payload";

// Dynamically import Stripe services
let PaymentMethodsService: any;
try {
  const stripeBilling = require("@sparrowapp-dev/stripe-billing");
  PaymentMethodsService = stripeBilling.PaymentMethodsService;
} catch (error) {
  console.warn("PaymentMethods service not available");
}

@ApiTags("payment-methods")
@Controller("api/payment-methods")
export class PaymentMethodsController {
  private isServiceAvailable: boolean;

  constructor(
    @Optional()
    @Inject(PaymentMethodsService)
    private readonly paymentMethodsService: any,
  ) {
    this.isServiceAvailable = !!this.paymentMethodsService;

    if (!this.isServiceAvailable) {
      console.warn(
        "PaymentMethods service is not available. Endpoints will be disabled.",
      );
    }
  }

  private checkServiceAvailability() {
    if (!this.isServiceAvailable) {
      throw new HttpException(
        "Payment method features are not available",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Get("customer/:customerId")
  @ApiOperation({
    summary: "Get all payment methods for a customer",
    description:
      "Retrieves all saved payment methods associated with a Stripe customer",
  })
  @ApiParam({
    name: "customerId",
    description: "Stripe customer ID",
    example: "cus_12345",
  })
  @ApiResponse({
    status: 200,
    description: "Returns the customer's payment methods",
    type: PaymentMethodsResponseDto,
  })
  async getPaymentMethods(
    @Param("customerId") customerId: string,
  ): Promise<PaymentMethodsResponseDto> {
    try {
      this.checkServiceAvailability();

      const paymentMethods =
        await this.paymentMethodsService.getPaymentMethods(customerId);

      const customer = await this.paymentMethodsService.getCustomer(customerId);

      // Handle the default payment method which could be a string or an object
      let defaultPaymentMethodId: string | null = null;
      if (customer?.invoice_settings?.default_payment_method) {
        defaultPaymentMethodId =
          typeof customer.invoice_settings.default_payment_method === "string"
            ? customer.invoice_settings.default_payment_method
            : customer.invoice_settings.default_payment_method.id;
      }

      // Format the response to match the original controller format
      const formattedPaymentMethods = paymentMethods.map((pm: any) => {
        const formattedMethod: PaymentMethodDto = {
          id: pm.id,
          type: pm.type,
          billing_details: pm.billing_details,
          isDefault: pm.id === defaultPaymentMethodId,
        };

        // Only add card details if they exist
        if (pm.type === "card" && pm.card) {
          formattedMethod.card = {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          };
        }

        return formattedMethod;
      });

      return { paymentMethods: formattedPaymentMethods };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to get payment methods",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Get(":id")
  @ApiOperation({ summary: "Get a specific payment method" })
  @ApiParam({
    name: "id",
    description: "Payment method ID",
    example: "pm_12345",
  })
  @ApiResponse({
    status: 200,
    description: "Returns the payment method",
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({ status: 404, description: "Payment method not found" })
  async getPaymentMethod(
    @Param("id") paymentMethodId: string,
  ): Promise<PaymentMethodResponseDto> {
    try {
      this.checkServiceAvailability();

      const paymentMethod =
        await this.paymentMethodsService.getPaymentMethod(paymentMethodId);
      return { paymentMethod };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to get payment method",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("default")
  @ApiOperation({
    summary: "Set a payment method as default",
    description:
      "Sets the specified payment method as the default for a customer",
  })
  @ApiResponse({
    status: 200,
    description: "Default payment method set successfully",
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Customer or payment method not found",
  })
  async setDefaultPaymentMethod(
    @Body() setDefaultDto: SetDefaultPaymentMethodDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.paymentMethodsService.setDefaultPaymentMethod(
      setDefaultDto.customerId,
      setDefaultDto.paymentMethodId,
    );

    return {
      success: true,
      message: "Default payment method set successfully",
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Put(":id/billing-details")
  @ApiOperation({
    summary: "Update billing details for a payment method",
    description:
      "Updates the billing address and contact information for an existing payment method",
  })
  @ApiParam({
    name: "id",
    description: "Payment method ID",
    example: "pm_12345",
  })
  @ApiResponse({
    status: 200,
    description: "Payment method billing details updated successfully",
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({ status: 404, description: "Payment method not found" })
  async updateBillingDetails(
    @Param("id") paymentMethodId: string,
    @Body() updateBillingDetailsDto: UpdateBillingDetailsDto,
  ): Promise<PaymentMethodResponseDto> {
    try {
      this.checkServiceAvailability();

      const billingDetails = {
        name: updateBillingDetailsDto.name,
        email: updateBillingDetailsDto.email,
        phone: updateBillingDetailsDto.phone,
        address: updateBillingDetailsDto.address,
      };

      const paymentMethod =
        await this.paymentMethodsService.updatePaymentMethodBillingDetails(
          paymentMethodId,
          billingDetails,
        );

      return { paymentMethod };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to update payment method billing details",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("user", "admin")
  @Delete(":id")
  @ApiOperation({
    summary: "Detach a payment method from a customer",
    description:
      "Permanently removes a payment method from the customer account",
  })
  @ApiParam({
    name: "id",
    description: "Payment method ID",
    example: "pm_12345",
  })
  @ApiResponse({
    status: 200,
    description: "Payment method detached successfully",
    type: DeletePaymentMethodResponseDto,
  })
  @ApiResponse({ status: 404, description: "Payment method not found" })
  async detachPaymentMethod(
    @Param("id") paymentMethodId: string,
  ): Promise<DeletePaymentMethodResponseDto> {
    try {
      this.checkServiceAvailability();

      await this.paymentMethodsService.detachPaymentMethod(paymentMethodId);
      return { success: true, message: "Payment method detached successfully" };
    } catch (error) {
      throw new HttpException(
        error.message || "Failed to detach payment method",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
