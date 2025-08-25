import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CreateOrUpdateTeamDto,
  ResponseTeam,
  UpdateTeamDto,
} from "../payloads/team.payload";
import { TeamRepository } from "../repositories/team.repository";
import {
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";
import {
  Invite,
  Team,
  TeamWithNewInviteTag,
} from "@src/modules/common/models/team.model";
import { ProducerService } from "@src/modules/common/services/event-producer.service";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { ConfigService } from "@nestjs/config";
import { UserRepository } from "../repositories/user.repository";

import { MemoryStorageFile } from "@blazity/nest-file-fastify";
import { TeamRole } from "@src/modules/common/enum/roles.enum";
import { UserInvitesRepository } from "../repositories/userInvites.repository";
import { PlanRepository } from "../repositories/plan.repository";
import { EmailService } from "@src/modules/common/services/email.service";
import { DecodedUserObject } from "@src/types/fastify";
import { BillingAuditService } from "@src/modules/billing/services/billing-audit.service";
import {
  BillingActorType,
  BillingSource,
} from "@src/modules/common/enum/billing.enum";

/**
 * Team Service
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly producerService: ProducerService,
    private readonly configService: ConfigService,
    private readonly userInvitesRepository: UserInvitesRepository,
    private readonly userRepository: UserRepository,
    private readonly planRepository: PlanRepository,
    private readonly emailService: EmailService,
    private readonly billingAuditService: BillingAuditService,
  ) {}

  async isImageSizeValid(size: number) {
    if (size < this.configService.get("app.imageSizeLimit")) {
      return true;
    }
    throw new BadRequestException("Image size should be less than 2MB");
  }

  private sanitizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") // replace special chars and spaces with '-'
      .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
  }

  async generateUniqueTeamUrl(name: string): Promise<string> {
    const prefix = "https://";
    const suffix = ".sparrowhub.net";
    // const envPath =
    //   this.configService.get("app.env") === Env.PROD ? "/release/v1" : "/dev";
    let base = this.sanitizeName(name);
    if (base.length > 50) {
      base = base.slice(0, 50);
    }
    const baseUrl = `${prefix}${base}`;

    const regexPattern = `^${baseUrl}\\d*${suffix}$`;
    const existingHubs =
      await this.teamRepository.existingHubUrls(regexPattern);
    const existingUrls = new Set(existingHubs.map((hub) => hub.hubUrl));

    const finalUrl = `${baseUrl}${suffix}`;

    if (!existingUrls.has(finalUrl)) {
      return finalUrl;
    }

    // Find next available suffix
    let counter = 1;
    while (existingUrls.has(`${baseUrl}${counter}${suffix}`)) {
      counter++;
    }

    return `${baseUrl}${counter}${suffix}`;
  }

  /**
   * Creates a new team in the database
   * @param {CreateOrUpdateTeamDto} teamData
   * @returns {Promise<InsertOneResult<Team>>} result of the insert operation
   */
  async create(
    teamData: CreateOrUpdateTeamDto,
    user: DecodedUserObject,
    image?: MemoryStorageFile,
  ): Promise<InsertOneResult<Team>> {
    const MAX_NAME_LENGTH = 100;
    // Checks if string has only special characters (no letters or numbers)
    const SAFE_NAME_REGEX = /^(?=.*[a-zA-Z0-9])[a-zA-Z0-9 _\-\.@]+$/;

    if (
      typeof teamData.name !== "string" ||
      teamData.name.trim().length === 0 || // empty after trim
      teamData.name.length > MAX_NAME_LENGTH || // too long
      !SAFE_NAME_REGEX.test(teamData.name) // only special chars
    ) {
      throw new BadRequestException(
        `Team name must be 1-${MAX_NAME_LENGTH} characters and cannot consist of only special characters.`,
      );
    }

    let team;
    const defaultHubPlan = this.configService.get<string>("app.defaultHubPlan");

    const dynamicUrl = await this.generateUniqueTeamUrl(teamData.name);
    if (image) {
      await this.isImageSizeValid(image.size);
      const dataBuffer = image.buffer;
      const dataString = dataBuffer.toString("base64");
      const logo = {
        bufferString: dataString,
        encoding: image.encoding,
        mimetype: image.mimetype,
        size: image.size,
      };

      team = {
        name: teamData.name,
        description: teamData.description ?? "",
        logo: logo,
        hubUrl: dynamicUrl,
        linkedinUrl: "",
        xUrl: "",
        githubUrl: "",
      };
    } else {
      team = {
        name: teamData.name,
        description: teamData.description ?? "",
        hubUrl:
          teamData?.hubUrl && teamData.hubUrl.length > 0
            ? teamData.hubUrl
            : dynamicUrl,
        linkedinUrl: "",
        xUrl: "",
        githubUrl: "",
      };
    }

    let hubPlan;

    const userData = await this.userRepository.findUserByUserId(
      new ObjectId(user._id),
    );

    const plans = await this.planRepository.getPlans();
    for (let i = 0; i < plans.length; i++) {
      if (plans[i].name === defaultHubPlan) {
        hubPlan = {
          ...plans[i],
          id: plans[i]._id,
        };
        delete hubPlan._id;
      }
    }

    const createdTeam = await this.teamRepository.create(team, hubPlan, user);
    const updatedUserTeams = [...userData.teams];
    updatedUserTeams.push({
      id: createdTeam.insertedId,
      name: teamData.name,
      role: TeamRole.OWNER,
      isNewInvite: false,
      joinedAt: new Date(),
    });
    const updatedUserParams = {
      teams: updatedUserTeams,
    };
    await this.userRepository.updateUserById(
      new ObjectId(userData._id),
      updatedUserParams,
    );

    // Record hub creation event for billing audit
    await this.billingAuditService.recordHubCreated(
      createdTeam.insertedId.toString(),
      teamData.name,
      defaultHubPlan,
      {
        actor: {
          type: BillingActorType.USER,
          id: user._id.toString(),
          name: user.name,
        },
        source: BillingSource.USER_ACTION,
        reason: "Hub/Team creation",
      },
      {
        hubUrl: team.hubUrl,
        description: team.description,
        planLimits: hubPlan?.limits,
      },
    );

    if (teamData?.firstTeam) {
      const workspaceObj = {
        name: this.configService.get("app.defaultWorkspaceName"),
        id: createdTeam.insertedId.toString(),
        firstWorkspace: true,
        user,
      };
      await this.producerService.produce(TOPIC.CREATE_USER_TOPIC, {
        value: JSON.stringify(workspaceObj),
      });
    }
    return createdTeam;
  }

  /**
   * Fetches a team from database by UUID
   * @param {string} id
   * @returns {Promise<Team>} queried team data
   */
  async get(id: string): Promise<WithId<Team>> {
    const data = await this.teamRepository.get(id);
    data?.invites?.forEach((invite) => {
      delete invite.inviteId;
      delete invite.isAccepted;
      delete invite.workspaces;
    });
    return data;
  }

  /**
   * Fetches a public team from database by UUID
   * @param {string} id
   * @returns {Promise<Team>} queried team data
   */
  async getPublic(id: string): Promise<WithId<ResponseTeam>> {
    const data = await this.teamRepository.get(id);
    const owner = data.users?.filter((user) => user.role === "owner") || [];
    return {
      _id: data._id,
      name: data.name,
      description: data.description,
      hubUrl: data.hubUrl,
      linkedinUrl: data.linkedinUrl,
      xUrl: data.xUrl,
      githubUrl: data.githubUrl,
      users: owner,
      owner: data.owner,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      logo: data.logo,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  }

  /**
   * Updates a team name
   * @param {string} id
   * @returns {Promise<ITeam>} mutated team data
   */
  async update(
    id: string,
    teamData: Partial<UpdateTeamDto>,
    userId: ObjectId,
    image?: MemoryStorageFile,
  ): Promise<UpdateResult<Team>> {
    const teamOwner = await this.isTeamOwner(id, userId);
    if (!teamOwner) {
      throw new BadRequestException("You don't have Access");
    }
    const teamDetails = await this.get(id);
    if (!teamDetails) {
      throw new BadRequestException(
        "The teams with that id does not exist in the system.",
      );
    }

    const MAX_NAME_LENGTH = 100;
    const SAFE_NAME_REGEX = /^(?=.*[a-zA-Z0-9])[a-zA-Z0-9 _\-\.@]+$/;
    if (
      teamData.name !== undefined &&
      (typeof teamData.name !== "string" ||
        teamData.name.trim().length === 0 ||
        teamData.name.length > MAX_NAME_LENGTH ||
        !SAFE_NAME_REGEX.test(teamData.name))
    ) {
      throw new BadRequestException(
        `Team name must be 1-${MAX_NAME_LENGTH} characters, contain at least one letter or number, and only use spaces, dashes, underscores, dots, or @.`,
      );
    }
    let team;
    if (image) {
      await this.isImageSizeValid(image.size);
      const dataBuffer = image.buffer;
      const dataString = dataBuffer.toString("base64");
      const logo = {
        bufferString: dataString,
        encoding: image.encoding,
        mimetype: image.mimetype,
        size: image.size,
      };
      team = {
        name: teamData.name ?? teamDetails.name,
        description: teamData.description ?? teamDetails.description,
        logo: logo,
        githubUrl: teamData?.githubUrl ?? teamDetails.githubUrl,
        linkedinUrl: teamData?.linkedinUrl ?? teamDetails.linkedinUrl,
        xUrl: teamData?.xUrl ?? teamDetails.xUrl,
      };
    } else {
      team = {
        name: teamData.name ?? teamDetails.name,
        description: teamData.description ?? teamDetails.description,
        githubUrl: teamData?.githubUrl ?? teamDetails.githubUrl,
        linkedinUrl: teamData?.linkedinUrl ?? teamDetails.linkedinUrl,
        xUrl: teamData?.xUrl ?? teamDetails.xUrl,
        hubUrl: teamData?.hubUrl ?? teamDetails.hubUrl,
      };
    }
    const data = await this.teamRepository.update(id, team);
    if (teamData?.name) {
      const team = {
        teamId: teamDetails._id.toString(),
        teamName: teamData.name,
        teamWorkspaces: teamDetails.workspaces,
      };
      await this.producerService.produce(TOPIC.TEAM_DETAILS_UPDATED_TOPIC, {
        value: JSON.stringify(team),
      });
    }
    return data;
  }

  /**
   * Delete a team from the database by UUID
   * @param {string} id
   * @returns {Promise<DeleteWriteOpResultObject>} result of the delete operation
   */
  async delete(id: string): Promise<DeleteResult> {
    const data = await this.teamRepository.delete(id);
    return data;
  }

  public isInviteExpired(expiresAt: Date): boolean {
    const now = new Date();
    return new Date(expiresAt) < now;
  }

  async getAllTeams(
    userId: string,
    currentUser: DecodedUserObject,
  ): Promise<WithId<Team>[]> {
    const user = await this.userRepository.getUserById(userId, currentUser);
    if (!user) {
      throw new BadRequestException(
        "The user with this id does not exist in the system",
      );
    }

    const userWorkspaceIds = user.workspaces.map((w) =>
      w.workspaceId.toString(),
    );

    // Collect team IDs from user.teams
    const teamIdsFromUser = user.teams.map((t) => t.id.toString());

    // Collect team IDs from invites
    const existingInvites = await this.userInvitesRepository.getByEmail(
      user.email,
    );
    const teamIdsFromInvites =
      existingInvites?.teamIds?.map((id) => id.toString()) || [];

    // Merge + deduplicate
    const allTeamIds = [
      ...new Set([...teamIdsFromUser, ...teamIdsFromInvites]),
    ];

    // Bulk fetch all teams
    const teamDocs = await this.teamRepository.getTeamsByIds(allTeamIds);
    // Map of teamId => teamData
    const teamMap = new Map<string, WithId<Team>>();
    for (const team of teamDocs) {
      // Sanitize invites
      team.invites?.forEach((invite: Invite) => {
        delete invite.inviteId;
        delete invite.isAccepted;
        delete invite.workspaces;
      });
      teamMap.set(team._id.toString(), team);
    }

    const teams: WithId<TeamWithNewInviteTag>[] = [];

    // First, process teams from user.teams
    for (const { id, isNewInvite } of user.teams) {
      const teamData = teamMap.get(id.toString());
      if (!teamData) continue;

      const filteredWorkspaces = teamData.workspaces.filter((w) =>
        userWorkspaceIds.includes(w.id.toString()),
      );

      teams.push({
        ...teamData,
        workspaces: filteredWorkspaces,
        isNewInvite,
      });
    }

    // Now, process invite-based teams
    for (const teamId of teamIdsFromInvites) {
      const teamData = teamMap.get(teamId);
      if (!teamData) continue;

      const specificInvite = teamData.invites.find(
        (invite) => invite.email === user.email,
      );
      const isValidInvite =
        specificInvite && !this.isInviteExpired(specificInvite.expiresAt);

      if (isValidInvite) {
        const createdById = specificInvite?.createdBy?.toString();
        let senderData;
        if (createdById) {
          senderData = await this.userRepository.getUserById(createdById);
        }

        teams.push({
          _id: new ObjectId(teamId),
          logo: teamData.logo,
          name: teamData.name,
          hubUrl: teamData.hubUrl,
          plan: teamData.plan,
          workspaces: [],
          description: senderData?.name || "No creator found",
        } as any);
      }
    }

    return teams;
  }

  async getTeams(): Promise<WithId<Team>[]> {
    return await this.teamRepository.getTeams();
  }

  async isTeamOwner(id: string, userId: ObjectId): Promise<boolean> {
    const teamDetails = await this.teamRepository.findTeamByTeamId(
      new ObjectId(id),
    );
    if (teamDetails.owner.toString() !== userId.toString()) {
      return false;
    }
    return true;
  }

  async isTeamOwnerOrAdmin(
    id: ObjectId,
    currentUserId: ObjectId,
  ): Promise<WithId<Team>> {
    const data = await this.teamRepository.findTeamByTeamId(id);
    if (data) {
      if (data.owner.toString() === currentUserId.toString()) {
        return data;
      } else {
        for (const item of data.admins) {
          if (item.toString() === currentUserId.toString()) {
            return data;
          }
        }
      }
      throw new BadRequestException("You don't have access");
    }
    throw new BadRequestException("Team doesn't exist");
  }

  async isTeamMember(userId: string, userArray: Array<any>): Promise<boolean> {
    for (const item of userArray) {
      if (item.id.toString() === userId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Disable team new invite tag
   * @returns {Promise<IUser>} queried team data
   */
  async disableTeamNewInvite(
    userId: string,
    teamId: string,
    user: DecodedUserObject,
  ): Promise<Team> {
    const teams = user.teams.map((team) => {
      if (team.id.toString() === teamId) {
        team.isNewInvite = false;
      }
      return team;
    });
    await this.userRepository.updateUserById(new ObjectId(userId), {
      teams,
    });
    const teamDetails = await this.teamRepository.get(teamId);
    const userWorkspaceIds = user.workspaces.map((_workspace) => {
      return _workspace.workspaceId;
    });
    teamDetails.workspaces = teamDetails.workspaces.filter((_workspace) => {
      if (userWorkspaceIds.includes(_workspace.id.toString())) {
        return true;
      }
      return false;
    });
    return teamDetails;
  }

  async teamPlanUpgradeOwner(teamId: string) {
    const teamDetails = await this.teamRepository.get(teamId);
    const isTeamOwnerId = teamDetails?.owner;
    if (isTeamOwnerId) {
      const userDetails = await this.userRepository.getUserById(isTeamOwnerId);
      const transporter = this.emailService.createTransporter();
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: userDetails?.email,
        text: "Rquest for Plan Upgrade",
        template: "planUpgradeOwnerEmail",
        context: {
          teamName: teamDetails?.name,
          userName: userDetails?.name || userDetails?.email,
          sparrowEmail: this.configService.get("support.sparrowEmail"),
          sparrowWebsite: this.configService.get("support.sparrowWebsite"),
          sparrowWebsiteName: this.configService.get(
            "support.sparrowWebsiteName",
          ),
        },
        subject: `Request to Upgrade Plan`,
      };

      const promise = [this.emailService.sendEmail(transporter, mailOptions)];
      Promise.all(promise);
    }
  }

  async doesHubUrlExist(
    hubUrl: string,
  ): Promise<{ isExist: boolean; isInvalid: boolean }> {
    // Validate hubUrl format
    try {
      const match = hubUrl.match(/^https:\/\/([a-z0-9-]+)\.sparrowhub\.net$/);
      let isInvalid = false;
      if (!match) {
        isInvalid = true;
      }
      const subdomain = match[1];
      // Check if subdomain matches sanitized version
      if (subdomain !== this.sanitizeName(subdomain)) {
        isInvalid = true;
      }
      const isExist = await this.teamRepository.doesHubUrlExist(hubUrl);
      return {
        isExist,
        isInvalid,
      };
    } catch (error) {
      return {
        isExist: false,
        isInvalid: true,
      };
    }
  }

  async updateHubTrialAndPlan(teamId: string, userCount?: number) {
    const teamDetails = await this.teamRepository.get(teamId);
    if (!teamDetails) {
      throw new BadRequestException("Team not found");
    }

    if (userCount) {
      teamDetails.plan.limits.usersPerHub.value = userCount;
    }

    const updatedTeam = await this.teamRepository.updateTrialAndPlan(
      teamId,
      true,
      teamDetails.plan,
    );
    return updatedTeam;
  }
}
