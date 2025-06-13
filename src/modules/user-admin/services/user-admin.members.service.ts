import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { AdminMembersRepository } from "../repositories/user-admin.members.repository";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";
import { TeamRole } from "@src/modules/common/enum/roles.enum";

@Injectable()
export class AdminMembersService {
  constructor(
    private readonly adminHubsRepo: AdminHubsRepository,
    private readonly adminMembersRepo: AdminMembersRepository,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async getPaginatedHubMembers(
    hubId: string,
    page: number,
    limit: number,
    search: string,
  ) {
    const hub = await this.adminHubsRepo.findHubById(hubId);
    if (!hub) {
      throw new NotFoundException("Hub not found");
    }

    // Get all members
    let members = hub.users || [];

    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase();
      members = members.filter(
        (member: any) =>
          member.name?.toLowerCase().includes(searchLower) ||
          member.email?.toLowerCase().includes(searchLower),
      );
    }

    // Get total count for pagination
    const totalCount = members.length;

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedMembers = members.slice(skip, skip + limit);

    // Format each member with the required fields
    const formattedMembers = await Promise.all(
      paginatedMembers.map(async (member: any) => {
        const workspaceAccess =
          await this.adminMembersRepo.countUserWorkspacesByHubId(
            member.id,
            hubId,
          );
        const memberWorkspaces = await this.workspaceService.getAllWorkSpaces(
          member.id,
        );

        const teamWorkspaces = memberWorkspaces.filter(
          (workspace) => workspace.team.id === hubId,
        );

        const simplifiedWorkspaces = teamWorkspaces.map((workspace) => {
          const memberRole =
            workspace.users.find(
              (user) => user.id.toString() === member.id.toString(),
            )?.role || null;

          return {
            workspace: workspace,
            userRole: memberRole,
          };
        });

        return {
          id: member.id,
          name: member.name || "Unknown",
          email: member.email,
          role: member.role.charAt(0).toUpperCase() + member.role.slice(1),
          workspaceAccess,
          lastActive: "",
          simplifiedWorkspaces,
        };
      }),
    );

    return {
      members: formattedMembers,
      totalCount,
      hubName: hub.name,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limit,
    };
  }

  async getPaginatedHubInvites(
    hubId: string,
    page: number,
    limit: number,
    search: string,
  ) {
    const hub = await this.adminHubsRepo.findHubById(hubId);
    if (!hub) {
      throw new NotFoundException("Hub not found");
    }

    // Get all invites
    let invites = hub.invites || [];

    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase();
      invites = invites.filter((invite: any) =>
        invite.email?.toLowerCase().includes(searchLower),
      );
    }

    // Get total count for pagination
    const totalCount = invites.length;

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedInvites = invites.slice(skip, skip + limit);

    // Format each invite with the required fields
    const formattedInvites = paginatedInvites.map((invite: any) => ({
      id: invite.inviteId,
      email: invite.email,
      role: invite.role.charAt(0).toUpperCase() + invite.role.slice(1),
      lastInvited: invite.updatedAt,
    }));

    return {
      invites: formattedInvites,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limit,
    };
  }

  /**
   * Get Stripe customer ID for a hub
   * @param hubId The hub/team ID
   * @returns The Stripe customer ID or null if not found
   */
  async getStripeCustomerId(hubId: string): Promise<string | null> {
    try {
      const hub = await this.adminHubsRepo.findHubById(hubId);

      if (!hub) {
        throw new NotFoundException("Hub not found");
      }

      return hub.stripeCustomerId || null;
    } catch (error) {
      console.error("Error fetching Stripe customer ID:", error);
      throw error;
    }
  }

  /**
   * Save Stripe customer ID for a hub
   * @param hubId The hub/team ID
   * @param customerId The Stripe customer ID
   * @param userId The user ID making the request (for authorization check)
   */
  async saveStripeCustomerId(
    hubId: string,
    customerId: string,
    userId: string,
  ): Promise<void> {
    // Get hub and verify user has permission to update it
    const hub = await this.adminHubsRepo.findHubById(hubId);

    if (!hub) {
      throw new NotFoundException("Hub not found");
    }

    // Check if user is owner or admin of the hub
    const userInHub = hub.users.find(
      (user: { id: string }) => user.id.toString() === userId.toString(),
    );

    if (
      !userInHub ||
      (userInHub.role !== TeamRole.OWNER && userInHub.role !== TeamRole.ADMIN)
    ) {
      throw new UnauthorizedException(
        "Only hub owners and admins can update the Stripe customer ID",
      );
    }

    // Update the hub with the new customer ID
    await this.adminHubsRepo.updateHubStripeCustomerId(hubId, customerId);
  }
}
