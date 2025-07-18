import {
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  IsObject,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import {
  BillingActorType,
  BillingEntityType,
  BillingEventType,
  BillingSource,
  BillingTransactionType,
} from "../enum/billing.enum";

export class PaymentProviderDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsBoolean()
  @IsOptional()
  currentPaymentMethod?: boolean;

  @IsString()
  @IsOptional()
  subscriptionId?: string;

  @IsArray()
  @IsOptional()
  payment_method?: string[];

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  updatedAt?: Date;
}

export class ScheduledDowngradeDto {
  @IsBoolean()
  @IsOptional()
  isScheduledDowngrade?: boolean;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @IsString()
  @IsOptional()
  planName?: string;

  @IsString()
  @IsOptional()
  scheduleId?: string;

  @IsString()
  @IsOptional()
  originalSubscription?: string;

  @IsBoolean()
  @IsOptional()
  downgradeAtPeriodEnd?: boolean;

  @IsString()
  @IsOptional()
  userCount?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  scheduledAt?: Date;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

export class BillingDto {
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  current_period_start?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  current_period_end?: Date;

  @IsNumber()
  @IsOptional()
  amount_billed?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  latest_invoice?: string;

  @IsString()
  @IsOptional()
  seats?: string;

  @IsString()
  @IsOptional()
  invoice_url?: string;

  @IsString()
  @IsOptional()
  billingType?: string;

  @IsBoolean()
  @IsOptional()
  in_trial?: boolean;

  @IsString()
  @IsOptional()
  billing_reason?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  failed_at?: Date;

  @IsString()
  @IsOptional()
  updatedBy?: string;

  @IsString()
  @IsOptional()
  event_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentProviderDto)
  @IsOptional()
  paymentProviders?: PaymentProviderDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => ScheduledDowngradeDto)
  @IsOptional()
  scheduledDowngrade?: ScheduledDowngradeDto;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  canceled_at?: Date;

  @IsBoolean()
  @IsOptional()
  trial_expired?: boolean;

  @IsString()
  @IsOptional()
  cancellation_reason?: string;

  @IsBoolean()
  @IsOptional()
  subscription_expired_email_sent?: boolean | Date;
}

class BillingChangeDto {
  @IsString()
  @IsOptional()
  field: string;

  @IsOptional()
  previousValue: any;

  @IsOptional()
  newValue: any;
}

class BillingActorDto {
  @IsEnum(BillingActorType)
  @IsOptional()
  type: BillingActorType;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class BillingContextDto {
  @ValidateNested()
  @Type(() => BillingActorDto)
  @IsOptional()
  actor: BillingActorDto;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsEnum(BillingSource)
  @IsOptional()
  source: BillingSource;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  externalId?: string;
}

class BillingFinancialImpactDto {
  @IsNumber()
  @IsOptional()
  amount: number;

  @IsString()
  @IsOptional()
  currency: string;

  @IsEnum(BillingTransactionType)
  @IsOptional()
  transactionType: BillingTransactionType;
}

export class BillingEventDto {
  @IsEnum(BillingEventType)
  @IsOptional()
  eventType: BillingEventType;

  @IsEnum(BillingEntityType)
  @IsOptional()
  entityType: BillingEntityType;

  @IsString()
  @IsOptional()
  entityId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingChangeDto)
  @IsOptional()
  changes: BillingChangeDto[];

  @ValidateNested()
  @Type(() => BillingContextDto)
  @IsOptional()
  context: BillingContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BillingFinancialImpactDto)
  financialImpact?: BillingFinancialImpactDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  timestamp: Date;

  @IsNumber()
  @IsOptional()
  version: number;
}

export class BillingTransactionDto {
  @IsEnum(BillingEntityType)
  @IsOptional()
  entityType: BillingEntityType;

  @IsString()
  @IsOptional()
  entityId: string;

  @IsEnum(BillingTransactionType)
  @IsOptional()
  transactionType: BillingTransactionType;

  @IsNumber()
  @IsOptional()
  amount: number;

  @IsString()
  @IsOptional()
  currency: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsOptional()
  @IsString()
  externalTransactionId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  timestamp: Date;

  @IsOptional()
  @IsString()
  processingError?: string;
}
