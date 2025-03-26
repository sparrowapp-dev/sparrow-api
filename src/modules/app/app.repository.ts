import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

/**
 * App Repository
 */
@Injectable()
export class AppRepository {
  /**
   * Constructor for App Repository.
   * @param db The MongoDB database connection injected by the NestJS dependency injection system.
   */
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  /**
   * Check if the existing database connection is active.
   * @returns True if the database is connected, otherwise false.
   */
  async isMongoConnected(): Promise<boolean> {
    try {
      // Perform a lightweight operation to verify connection health
      await this.db.admin().ping();
      return true;
    } catch (error) {
      console.error("MongoDB connection lost:", error);
      return false;
    }
  }
}
