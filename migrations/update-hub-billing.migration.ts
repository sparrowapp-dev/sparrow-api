import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Db, ObjectId } from "mongodb";

@Injectable()
export class UpdateHubBillingMigration implements OnModuleInit {
  private hasRun = false;

  constructor(@Inject("DATABASE_CONNECTION") private readonly db: Db) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;

    try {
      console.log(
        "\x1b[36m[Nest]\x1b[0m \x1b[36mStarting Updating Billing...\x1b[0m",
      );
      // Add pricing details to pricing collection
      // const pricing = {
      //   name: "Default Pricing",
      //   currency: "usd",
      //   plans: [
      //     {
      //       tier: "Standard",
      //       plan_name: "Standard",
      //       billing: [
      //         {
      //           interval: "monthly",
      //           price: 9.99,
      //           providers: {
      //             stripe: "id1",
      //           },
      //         },
      //         {
      //           interval: "annual",
      //           price: 99,
      //           providers: {
      //             stripe: "id2",
      //           },
      //         },
      //       ],
      //     },
      //     {
      //       tier: "Professional",
      //       plan_name: "Professional",
      //       billing: [
      //         {
      //           interval: "monthly",
      //           price: 19.99,
      //           providers: {
      //             stripe: "id3",
      //           },
      //         },
      //         {
      //           interval: "annual",
      //           price: 199,
      //           providers: {
      //             stripe: "oid4",
      //           },
      //         },
      //       ],
      //     },
      //   ],
      //   version: 1,
      //   created_at: "2025-07-09T11:00:00.000Z",
      // };

      // await this.addPricing(pricing);
      const teamId = "team213123123";
      const billing = {
        current_period_start: new Date("2025-07-08T13:04:24.000Z"),
        current_period_end: new Date("2025-08-08T13:04:24.000Z"),
        amount_billed: 119.88,
        currency: "usd",
        status: "active",
        collection_method: "charge_manually",
        paid_at: new Date("2025-07-08T13:04:28.000Z"),
        billingType: "paid",
        updatedBy: "system-admin",
        in_trial: false,
        paymentProviders: [
          {
            id: "37069b1a-b266-4e9c-a010-31cd30075ac4",
            provider: "stripe",
            currentPaymentMethod: true,
            subscriptionId: "",
            payment_method: ["card"],
            customerId: "cus_SdRmVfW1qK0Ruw",
            updatedAt: new Date("2025-07-08T13:04:29.146Z"),
          },
        ],
      };
      await this.addBillingToTeam(teamId, billing);

      this.hasRun = true;
    } catch (error) {
      console.error(
        "\x1b[31m[Nest] Error during UpdateHubBillingMigration:\x1b[0m",
        error,
      );
    }
  }
  private async addPricing(pricing: any): Promise<void> {
    const pricingCollection = this.db.collection(Collections.PRICING);
    await pricingCollection.insertOne(pricing);
    console.log(
      "\x1b[32m[Nest]\x1b[0m Pricing details added to pricing collection",
    );
  }
  private async addBillingToTeam(teamId: string, billing: any): Promise<void> {
    const teamCollection = this.db.collection(Collections.TEAM);
    await teamCollection.updateOne(
      { _id: new ObjectId(teamId) },
      {
        $set: {
          billing: billing,
        },
      },
    );
    console.log(`\x1b[32m[Nest]\x1b[0m Billing info added to team ${teamId}`);
  }
}
