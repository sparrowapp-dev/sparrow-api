import { Injectable } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { LicensesDto } from "@src/modules/common/models/licenses.model";
import { TeamRepository } from "@src/modules/identity/repositories/team.repository";
import { BillingAuditService } from "./billing-audit.service";
import {
  BillingEventType,
  BillingActorType,
  BillingSource,
} from "@src/modules/common/enum/billing.enum";

/**
 * License Management Service
 * Centralized service for handling license tracking across teams
 */
@Injectable()
export class LicenseManagementService {
  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly billingAuditService: BillingAuditService,
  ) {}

  /**
   * Log license changes for audit purposes
   * @param teamId - The team ID
   * @param eventType - The type of license event
   * @param context - Additional context for the event
   */
  private async logLicenseChange(
    teamId: string,
    eventType:
      | BillingEventType.SEAT_RESERVED_BY_USER_ADDITION
      | BillingEventType.SEAT_RELEASED_BY_USER_REMOVAL
      | BillingEventType.SEATS_CLEANED_UP_AS_UNUSED,
    context: string,
    previousLicense?: LicensesDto,
    newLicense?: LicensesDto,
  ): Promise<void> {
    try {
      if (!previousLicense || !newLicense) return;

      await this.billingAuditService.recordLicenseChange(
        teamId,
        eventType,
        previousLicense,
        newLicense,
        {
          actor: { type: BillingActorType.SYSTEM, name: "License Management" },
          source: BillingSource.API_CALL,
          reason: context,
        },
        {
          context,
          timestamp: new Date(),
        },
      );
    } catch (error) {
      console.error("Error logging license change:", error);
      // Don't throw to avoid breaking main operation
    }
  }

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

      // Store previous license state for audit
      const previousLicense: LicensesDto = team.licenses || {
        totalSeats: Number(team.licenses?.totalSeats || 1),
        usedSeats: Number(team.licenses?.usedSeats || 0),
        availableSeats: Number(team.licenses?.availableSeats || 1),
        lastUpdated: new Date(),
      };

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

      // Log license change audit event - determine event type based on usage change
      const previousUsedSeats = previousLicense.usedSeats || 0;
      const newUsedSeats = licenseData.usedSeats;

      if (newUsedSeats > previousUsedSeats) {
        // Users were added - seats reserved
        await this.logLicenseChange(
          teamId,
          BillingEventType.SEAT_RESERVED_BY_USER_ADDITION,
          "User added to team - seat reserved",
          previousLicense,
          licenseData,
        );
      } else if (newUsedSeats < previousUsedSeats) {
        // Users were removed - seats freed
        await this.logLicenseChange(
          teamId,
          BillingEventType.SEAT_RELEASED_BY_USER_REMOVAL,
          "User removed from team - seat freed",
          previousLicense,
          licenseData,
        );
      }
      // If no change in used seats, no audit event needed
    } catch (error) {
      console.error("Error updating license tracking:", error);
      // Don't throw error to avoid breaking the main operation
    }
  }
}
