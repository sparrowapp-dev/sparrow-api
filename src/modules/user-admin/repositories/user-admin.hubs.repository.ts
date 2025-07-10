import {
  Injectable,
  Inject,
  InternalServerErrorException,
} from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { PaymentProvider } from "@src/modules/common/enum/billing.enum";
import { Team } from "@src/modules/common/models/team.model";
import { Db, ObjectId, WithId } from "mongodb";

@Injectable()
export class AdminHubsRepository {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async findTeamsByUserId(
    userId: string,
    skip?: number,
    limit?: number,
    search?: string,
    sortBy: string = "createdAt",
    sortOrder: string = "desc",
    plan?: string,
  ) {
    const userObjectId = new ObjectId(userId);

    // Build query
    let queryConditions: Record<string, any> = {
      $or: [{ "users.id": userObjectId }, { "users.id": userId.toString() }],
    };

    if (search?.trim()) {
      queryConditions = {
        $and: [
          {
            $or: [
              { "users.id": userObjectId },
              { "users.id": userId.toString() },
            ],
          },
          {
            name: { $regex: search.trim(), $options: "i" },
          },
        ],
      };
    }

    // Add plan filter if plan !== "all"
    if (plan && plan.toLowerCase() !== "all") {
      if (queryConditions.$and) {
        queryConditions.$and.push({ "plan.name": plan });
      } else {
        queryConditions = {
          $and: [queryConditions, { "plan.name": plan }],
        };
      }
    }

    const collation = sortBy === "name" ? { locale: "en", strength: 2 } : null;

    const collection = this.db.collection("team");
    const query = collection
      .find(queryConditions)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 });

    // Apply collation if sorting by name
    if (collation) {
      query.collation(collation);
    }

    const totalCount = await collection.countDocuments(queryConditions);

    // Pagination
    if (typeof skip === "number" && typeof limit === "number") {
      const data = await query.skip(skip).limit(limit).toArray();
      return {
        data,
        pagination: {
          total: totalCount,
          currentPage: Math.floor(skip / limit) + 1,
          totalPages: Math.ceil(totalCount / limit),
          limit,
        },
        sort: { sortBy, sortOrder },
      };
    }

    const data = await query.toArray();
    return {
      data,
      pagination: {
        total: totalCount,
        currentPage: 1,
        totalPages: 1,
        limit: totalCount,
      },
      sort: { sortBy, sortOrder },
    };
  }

  async findBasicTeamsByUserId(userId: string) {
    const userObjectId = new ObjectId(userId);
    const userIdStr = userId.toString();
    const teams = await this.db
      .collection("team")
      .find({
        users: {
          $elemMatch: {
            $or: [
              { id: userObjectId }, // case where id is stored as ObjectId
              { id: userIdStr }, // case where id is stored as string
            ],
          },
        },
      })
      .toArray();

    return teams;
  }

  async findHubById(hubId: string) {
    return this.db.collection("team").findOne({ _id: new ObjectId(hubId) });
  }

  async findTeamsByQuery(query: any): Promise<WithId<Team>[]> {
    return await this.db
      .collection<Team>(Collections.TEAM)
      .find(query)
      .toArray();
  }
  async findTeamsByOwnerOrAdmin(userId: string): Promise<WithId<Team>[]> {
    const query = {
      $or: [{ owner: userId }, { admins: { $in: [userId] } }],
    };

    return await this.findTeamsByQuery(query);
  }

  /**
   * Update a hub's Stripe customer ID
   * @param hubId The hub ID
   * @param customerId The Stripe customer ID
   */
  async updateHubStripeCustomerId(
    hubId: string,
    customerId: string,
  ): Promise<void> {
    try {
      const hubObjectId = new ObjectId(hubId);

      // Get existing team to preserve existing payment providers
      const existingTeam = await this.db
        .collection(Collections.TEAM)
        .findOne({ _id: hubObjectId });

      const existingProviders = existingTeam?.billing?.paymentProviders || [];

      // Create or update Stripe provider in the array
      const updatedProviders = this.createOrUpdateStripeProvider(
        existingProviders,
        customerId,
      );

      await this.db.collection(Collections.TEAM).updateOne(
        { _id: hubObjectId },
        {
          $set: {
            "billing.paymentProviders": updatedProviders,
          },
        },
      );
    } catch (error) {
      console.error("Error updating hub Stripe customer ID:", error);
      throw new InternalServerErrorException(
        "Failed to update hub Stripe customer ID",
      );
    }
  }

  /**
   * Create or update Stripe payment provider in the array format
   * @param existingProviders Array of existing payment providers
   * @param customerId The Stripe customer ID
   * @returns Updated payment providers array
   */
  private createOrUpdateStripeProvider(
    existingProviders: any[] = [],
    customerId: string,
  ): any[] {
    const { v4: uuidv4 } = require("uuid");

    // Create a copy of existing providers
    const providers = [...existingProviders];

    // Find existing Stripe provider
    const existingIndex = providers.findIndex(
      (p) => p.provider === PaymentProvider.STRIPE,
    );

    // Mark all others as not current if we're adding/updating Stripe
    providers.forEach((p) => {
      if (p.provider !== PaymentProvider.STRIPE) {
        p.currentPaymentMethod = false;
      }
    });

    // Create new Stripe provider entry
    const stripeProvider = {
      id: uuidv4(),
      provider: PaymentProvider.STRIPE,
      currentPaymentMethod: true,
      customerId: customerId,
      updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
      // Update existing Stripe provider
      providers[existingIndex] = stripeProvider;
    } else {
      // Add new Stripe provider
      providers.push(stripeProvider);
    }

    return providers;
  }

  /**
   * Update team feedback in billing object
   * @param hubId The team/hub ID
   * @param feedback The feedback string
   * @returns The update result
   */
  async updateTeamFeedback(hubId: string, feedback: string): Promise<any> {
    try {
      const hubObjectId = new ObjectId(hubId);

      return await this.db.collection(Collections.TEAM).updateOne(
        { _id: hubObjectId },
        {
          $set: {
            "billing.feedback": feedback,
          },
        },
      );
    } catch (error) {
      console.error("Error updating team feedback:", error);
      throw new InternalServerErrorException("Failed to update team feedback");
    }
  }
}
