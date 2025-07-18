import { Injectable } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { LicensesDto } from "@src/modules/common/models/licenses.model";
import { TeamRepository } from "@src/modules/identity/repositories/team.repository";

/**
 * License Management Service
 * Centralized service for handling license tracking across teams
 */
@Injectable()
export class LicenseManagementService {
  constructor(private readonly teamRepository: TeamRepository) {}

  /**
   * Updates license tracking for a team
   * @param teamId - The team ID to update licenses for
   */
  async updateLicenseTracking(teamId: string): Promise<void> {
    try {
      const team = await this.teamRepository.findTeamByTeamId(
        new ObjectId(teamId),
      );

      if (!team) {
        console.warn(`Team not found for license tracking: ${teamId}`);
        return;
      }

      // Calculate current active users and pending invites
      const currentActiveUsers = team.users?.length || 0;
      const currentPendingInvites =
        team.invites?.filter((invite: any) => !invite.isAccepted).length || 0;
      const totalCurrentUsage = currentActiveUsers + currentPendingInvites;

      // Use provided seats or get from existing licenses/billing
      const totalSeats = team.licenses?.totalSeats || team.billing?.seats || 1;

      const licenseData: LicensesDto = {
        totalSeats: Number(totalSeats),
        usedSeats: Number(totalCurrentUsage),
        availableSeats: Number(totalSeats) - Number(totalCurrentUsage),
        lastUpdated: new Date(),
      };

      // Update team with license data
      await this.teamRepository.updateTeamById(new ObjectId(teamId), {
        licenses: licenseData,
      });
    } catch (error) {
      console.error("Error updating license tracking:", error);
      // Don't throw error to avoid breaking the main operation
    }
  }
}
