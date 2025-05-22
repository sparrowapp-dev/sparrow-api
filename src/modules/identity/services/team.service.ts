import { BadRequestException, Injectable } from "@nestjs/common";
import { CreateOrUpdateTeamDto, UpdateTeamDto } from "../payloads/team.payload";
import { TeamRepository } from "../repositories/team.repository";
import {
  DeleteResult,
  InsertOneResult,
  ObjectId,
  UpdateResult,
  WithId,
} from "mongodb";
import {
  Team,
  TeamWithNewInviteTag,
} from "@src/modules/common/models/team.model";
import { ProducerService } from "@src/modules/common/services/kafka/producer.service";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { ConfigService } from "@nestjs/config";
import { UserRepository } from "../repositories/user.repository";
import { ContextService } from "@src/modules/common/services/context.service";
import { MemoryStorageFile } from "@blazity/nest-file-fastify";
import { TeamRole } from "@src/modules/common/enum/roles.enum";
import { User } from "@src/modules/common/models/user.model";
import { UserInvitesRepository } from "../repositories/userInvites.repository";

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
    private readonly contextService: ContextService,
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
    image?: MemoryStorageFile,
  ): Promise<InsertOneResult<Team>> {
    let team;

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
        hubUrl: dynamicUrl,
        linkedinUrl: "",
        xUrl: "",
        githubUrl: "",
      };
    }
    const createdTeam = await this.teamRepository.create(team);
    const user = await this.contextService.get("user");
    const userData = await this.userRepository.findUserByUserId(
      new ObjectId(user._id),
    );
    const updatedUserTeams = [...userData.teams];
    updatedUserTeams.push({
      id: createdTeam.insertedId,
      name: teamData.name,
      role: TeamRole.OWNER,
      isNewInvite: false,
    });
    const updatedUserParams = {
      teams: updatedUserTeams,
    };
    await this.userRepository.updateUserById(
      new ObjectId(userData._id),
      updatedUserParams,
    );
    if (teamData?.firstTeam) {
      const workspaceObj = {
        name: this.configService.get("app.defaultWorkspaceName"),
        id: createdTeam.insertedId.toString(),
        firstWorkspace: true,
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
    const validInvites = data?.invites?.filter((invite) => {
      if (new Date(invite?.expiresAt) > new Date()) {
        return true;
      }
      return false;
    });
    data.invites = validInvites || [];
    data?.invites?.forEach((invite) => {
      delete invite.inviteId;
      delete invite.isAccepted;
      delete invite.workspaces;
    });
    return data;
  }

  /**
   * Updates a team name
   * @param {string} id
   * @returns {Promise<ITeam>} mutated team data
   */
  async update(
    id: string,
    teamData: Partial<UpdateTeamDto>,
    image?: MemoryStorageFile,
  ): Promise<UpdateResult<Team>> {
    const teamOwner = await this.isTeamOwner(id);
    if (!teamOwner) {
      throw new BadRequestException("You don't have Access");
    }
    const teamDetails = await this.get(id);
    if (!teamDetails) {
      throw new BadRequestException(
        "The teams with that id does not exist in the system.",
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

  async getAllTeams(userId: string): Promise<WithId<Team>[]> {
    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw new BadRequestException(
        "The user with this id does not exist in the system",
      );
    }
    const userWorkspaceIds = user.workspaces.map((_workspace) => {
      return _workspace.workspaceId;
    });

    const teams: WithId<Team>[] = [];
    for (const { id, isNewInvite } of user.teams) {
      const teamData: WithId<TeamWithNewInviteTag> = await this.get(
        id.toString(),
      );

      teamData.workspaces = teamData.workspaces.filter((_workspace) => {
        if (userWorkspaceIds.includes(_workspace.id.toString())) {
          return true;
        }
        return false;
      });

      teamData.isNewInvite = isNewInvite;

      teams.push(teamData);
    }
    const existingTeams = await this.userInvitesRepository.getByEmail(
      user.email,
    );
    const teamIds = existingTeams?.teamIds || [];
    if (teamIds) {
      for (const teamId of teamIds) {
        const teamData: WithId<TeamWithNewInviteTag> = await this.get(teamId);
        // Find the invite that matches the user's email (or another criterion)
        const specificInvite = teamData.invites.find(
          (invite) => invite.email === user.email,
        );
        let createdById = null;
        if (specificInvite) {
          createdById = specificInvite.createdBy.toString();
        }
        const senderData = await this.userRepository.getUserById(createdById);
        const team: any = {
          _id: teamId,
          logo: teamData.logo,
          name: teamData.name,
          hubUrl: teamData.hubUrl,
          workspaces: [],
          description: senderData?.name || "No creator found",
        };
        // Add the team object to the teams array
        teams.push(team);
      }
    }
    return teams;
  }

  async getTeams(): Promise<WithId<Team>[]> {
    return await this.teamRepository.getTeams();
  }

  async isTeamOwner(id: string): Promise<boolean> {
    const user = await this.contextService.get("user");
    const teamDetails = await this.teamRepository.findTeamByTeamId(
      new ObjectId(id),
    );
    if (teamDetails.owner.toString() !== user._id.toString()) {
      return false;
    }
    return true;
  }

  async isTeamOwnerOrAdmin(id: ObjectId): Promise<WithId<Team>> {
    const data = await this.teamRepository.findTeamByTeamId(id);
    const userId = this.contextService.get("user")._id;
    if (data) {
      if (data.owner.toString() === userId.toString()) {
        return data;
      } else {
        for (const item of data.admins) {
          if (item.toString() === userId.toString()) {
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
    user: WithId<User>,
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
}
