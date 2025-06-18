import { IsMongoId, IsNotEmpty, IsDate } from "class-validator";

/**
 * Represents a single AI usage log entry by a user within a team.
 */
export class UserLimitLog {
  /**
   * MongoDB ObjectId of the user who made the AI request.
   */
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  /**
   * MongoDB ObjectId of the team the user belongs to.
   */
  @IsMongoId()
  @IsNotEmpty()
  teamId: string;

  /**
   * Timestamp when the AI request was made.
   */
  @IsDate()
  @IsNotEmpty()
  requestedAt: Date;
}
