import { BadRequestException, Injectable } from "@nestjs/common";
import { TeamRepository } from "../repositories/team.repository";
import { CreateOrUpdateTeamUserDto } from "../payloads/teamUser.payload";
import { ObjectId, WithId } from "mongodb";
import { ContextService } from "@src/modules/common/services/context.service";
import { UserRepository } from "../repositories/user.repository";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { Team } from "@src/modules/common/models/team.model";
import { ProducerService } from "@src/modules/common/services/kafka/producer.service";

/**
 * Team User Service
 */
@Injectable()
export class TeamUserService {
  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly contextService: ContextService,
    private readonly userRepository: UserRepository,
    private readonly producerService: ProducerService,
  ) {}

  async HasPermission(data: Array<string>): Promise<boolean> {
    const user = this.contextService.get("user");
    for (const item of data) {
      if (item.toString() === user._id.toString()) {
        return true;
      }
    }
    throw new BadRequestException("You don't have access");
  }

  async isUserTeamMember(
    userId: string,
    userArray: Array<any>,
  ): Promise<boolean> {
    for (const item of userArray) {
      if (item.id.toString() === userId) return true;
    }
    throw new BadRequestException(
      "User is not part of team, first add user in Team",
    );
  }

  /**
   * Add a new user in the team
   * @param {CreateOrUpdateTeamUserDto} payload
   * @returns {Promise<InsertOneWriteOpResult<Team>>} result of the insert operation
   */
  async addUser(payload: CreateOrUpdateTeamUserDto): Promise<WithId<Team>> {
    const teamFilter = new ObjectId(payload.teamId);
    const teamData = await this.teamRepository.findTeamByTeamId(teamFilter);
    const userFilter = new ObjectId(payload.userId);
    const userData = await this.userRepository.findUserByUserId(userFilter);
    await this.HasPermission(teamData.owners);
    const updatedUsers = [...teamData.users];
    updatedUsers.push({
      id: payload.userId,
      email: userData.email,
      name: userData.name,
    });
    const updatedTeamParams = {
      users: updatedUsers,
    };

    const updatedTeams = [...userData.teams];
    updatedTeams.push({
      id: new ObjectId(payload.teamId),
      name: teamData.name,
    });
    const teamWorkspaces = [...teamData.workspaces];
    const message = {
      teamWorkspaces: teamWorkspaces,
      userId: userData._id,
    };
    await this.producerService.produce(TOPIC.USER_ADDED_TO_TEAM_TOPIC, {
      value: JSON.stringify(message),
    });
    const updateUserParams = {
      teams: updatedTeams,
    };
    await this.userRepository.updateUserById(userFilter, updateUserParams);

    const updatedTeamResponse = await this.teamRepository.updateTeamById(
      teamFilter,
      updatedTeamParams,
    );
    return updatedTeamResponse;
  }

  async removeUser(payload: CreateOrUpdateTeamUserDto): Promise<WithId<Team>> {
    const teamFilter = new ObjectId(payload.teamId);
    const teamData = await this.teamRepository.findTeamByTeamId(teamFilter);
    const userFilter = new ObjectId(payload.userId);
    const userData = await this.userRepository.findUserByUserId(userFilter);
    const teamOwners = teamData.owners;
    await this.HasPermission(teamOwners);
    const teamUser = [...teamData.users];
    const filteredData = teamUser.filter((item) => item.id !== payload.userId);
    const filteredOwner = teamOwners.filter(
      (id: string) => id.toString() !== payload.userId.toString(),
    );
    const teamUpdatedParams = {
      users: filteredData,
      owners: filteredOwner,
    };
    const userTeams = [...userData.teams];
    const userFilteredTeams = userTeams.filter(
      (item) => item.id.toString() !== payload.teamId.toString(),
    );
    const userUpdatedParams = {
      teams: userFilteredTeams,
    };
    await this.userRepository.updateUserById(userFilter, userUpdatedParams);
    const teamWorkspaces = [...teamData.workspaces];
    const message = {
      teamWorkspaces: teamWorkspaces,
      userId: userData._id,
    };
    await this.producerService.produce(TOPIC.USER_REMOVED_FROM_TEAM_TOPIC, {
      value: JSON.stringify(message),
    });
    const data = await this.teamRepository.updateTeamById(
      teamFilter,
      teamUpdatedParams,
    );
    return data;
  }

  async addOwner(payload: CreateOrUpdateTeamUserDto): Promise<WithId<Team>> {
    const teamFilter = new ObjectId(payload.teamId);
    const teamData = await this.teamRepository.findTeamByTeamId(teamFilter);
    const teamOwners = [...teamData.owners];
    await this.HasPermission(teamOwners);
    await this.isUserTeamMember(payload.userId, teamData.users);
    teamOwners.push(payload.userId);
    const updatedTeamData = {
      owners: teamOwners,
    };
    const message = {
      userId: payload.userId,
      teamWorkspaces: teamData.workspaces,
    };
    await this.producerService.produce(TOPIC.TEAM_OWNER_ADDED_TOPIC, {
      value: JSON.stringify(message),
    });
    const response = await this.teamRepository.updateTeamById(
      teamFilter,
      updatedTeamData,
    );
    return response;
  }
}
