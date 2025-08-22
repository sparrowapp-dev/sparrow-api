import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { TeamRole, WorkspaceRole } from "@src/modules/common/enum/roles.enum";
import { LimitArea } from "@src/modules/common/models/plan.model";
import { Team } from "@src/modules/common/models/team.model";
import { createHmac } from "crypto";

import { Db } from "mongodb";
const DEFAULT_TEAM = {
  name: "My Hub",
  description: "My Hub for Self-Hosted Sparrow",
};
const DEFAULT_WORKSPACE = {
  name: "My Workspace",
};
@Injectable()
export class SelftHostMigration implements OnModuleInit {
  private hasRun = false;
  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db, // Inject the MongoDB connection
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      if (this.hasRun) {
        // Check if migration has already run
        return;
      }
      const appEdition = await this.configService.get("app.appEdition");
      if (appEdition !== "MANAGED") {
        const defaultHubPlan = this.configService.get<string>(
          "app.selfHostHubPlan",
        );
        const adminEmail = this.configService.get<string>(
          "selfHost.adminEmail",
        );
        const adminPassword = this.configService.get<string>(
          "selfHost.adminPassword",
        );
        const planCollection = this.db.collection(Collections.PLAN);
        const userCollection = this.db.collection(Collections.USER);
        const teamsCollection = this.db.collection(Collections.TEAM);
        const workspaceCollection = this.db.collection(Collections.WORKSPACE);

        const existingPlan = await planCollection.findOne({
          name: defaultHubPlan,
        });

        if (!existingPlan) {
          const plan = {
            name: defaultHubPlan,
            description: "Enterprise tier with full access",
            active: true,
            limits: {
              workspacesPerHub: {
                area: LimitArea.HUB,
                value: 1000000,
              },
              testflowPerWorkspace: {
                area: LimitArea.WORKSPACE,
                value: 1000000,
              },
              blocksPerTestflow: {
                area: LimitArea.TESTFLOW,
                value: 1000000,
              },
              usersPerHub: {
                area: LimitArea.HUB,
                value: 1000000,
              },
              selectiveTestflowRun: {
                area: LimitArea.TESTFLOW,
                active: true,
              },
              activeSync: {
                area: LimitArea.COLLECTION,
                active: true,
              },
              testflowRunHistory: {
                area: LimitArea.TESTFLOW,
                value: 1000000,
              },
              aiRequestsPerMonth: {
                area: LimitArea.AI,
                value: 1000000,
              },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: "system",
            updatedBy: "system",
          };

          await planCollection.insertOne(plan);
          console.log("\x1b[36mSelf Hosted Plan created successfully.\x1b[0m");
        } else {
          console.log(
            "\x1b[33mSelf Hosted Plan already exists. Skipping.\x1b[0m",
          );
        }

        // Check if the user already exists
        const existingUser = await userCollection.findOne({
          email: adminEmail,
        });
        if (existingUser) {
          console.log("Admin already exists. Skipping migration.");
          return;
        }

        // Insert the new user
        const { insertedId: userId } = await userCollection.insertOne({
          name: "Admin",
          email: adminEmail,
          password: createHmac("sha256", adminPassword).digest("hex"),
          teams: [],
          workspaces: [],
          isEmailVerified: true,
          isSelfHostedVersionAdmin: true,
          isUserTrialExhausted: true,
        });
        const selfHostPlan = await planCollection.findOne({
          name: defaultHubPlan,
        });
        const hubUrl = await this.generateUniqueHubUrl(DEFAULT_TEAM.name);
        const hubPlan = {
          ...selfHostPlan,
          id: selfHostPlan._id,
        };
        delete hubPlan._id;

        // Insert the new team
        const teamData = {
          ...DEFAULT_TEAM,
          users: [
            {
              id: userId.toString(),
              email: adminEmail,
              name: "Admin",
              role: TeamRole.OWNER,
              owner: userId.toString(),
            },
          ],
          workspaces: [] as { id: string; name: string }[],
          owner: userId.toString(),
          admins: [] as string[],
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedBy: userId,
          plan: hubPlan,
          linkedinUrl: "",
          xUrl: "",
          githubUrl: "",
          hubUrl: hubUrl,
        };
        const { insertedId: teamId } =
          await teamsCollection.insertOne(teamData);

        // Update user with the new team
        await userCollection.updateOne(
          { _id: userId },
          {
            $set: {
              teams: [
                {
                  id: teamId,
                  name: DEFAULT_TEAM.name,
                  role: TeamRole.OWNER,
                  isNewInvite: false,
                },
              ],
            },
          },
        );
        // Prepare workspace users and admins
        const adminInfo = [];
        const usersInfo = [];

        for (const user of teamData.users) {
          if (user.role !== TeamRole.MEMBER) {
            adminInfo.push({
              id: user.id.toString(),
              name: user.name,
            });
            usersInfo.push({
              role: WorkspaceRole.ADMIN,
              id: user.id.toString(),
              name: user.name,
              email: user.email,
            });
          }
        }

        // Create new workspace
        const workspaceData = {
          ...DEFAULT_WORKSPACE,
          team: {
            id: teamId.toString(),
            name: DEFAULT_TEAM.name,
          },
          workspaceType: "PRIVATE",
          users: usersInfo,
          admins: adminInfo,
          environments: [] as any,
          collection: [] as any,
          createdAt: new Date(),
          createdBy: userId.toString(),
          updatedAt: new Date(),
          updatedBy: userId.toString(),
        };

        const { insertedId: workspaceId } =
          await workspaceCollection.insertOne(workspaceData);

        // Update workspace in team collection
        const teamWorkspaces = [
          { id: workspaceId.toString(), name: DEFAULT_WORKSPACE.name },
        ];

        const updateTeamParams = {
          workspaces: teamWorkspaces,
        };

        await teamsCollection.updateOne(
          { _id: teamId },
          { $set: updateTeamParams },
        );

        // Update workspace in user collection
        const updateUserParams = {
          workspaces: [
            {
              workspaceId: workspaceId.toString(),
              name: DEFAULT_WORKSPACE.name,
              teamId: teamId.toString(),
              isNewInvite: false,
            },
          ],
        };

        await userCollection.updateOne(
          { _id: userId },
          { $set: updateUserParams },
        );
        console.log("Admin added.");
      } else {
        console.log(
          "Skipping self-hosted migration as app is managed edition.",
        );
      }

      this.hasRun = true; // Set flag after successful execution
    } catch (error) {
      console.error("Error during migration:", error);
    }
  }
  private sanitizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  private async generateUniqueHubUrl(name: string): Promise<string> {
    const prefix = "https://";
    const suffix = ".sparrowhub.net";
    // const envPath =
    //   process.env.NODE_ENV === "production" ? "/release/v1" : "/dev";

    let base = this.sanitizeName(name);
    if (base.length > 50) {
      base = base.slice(0, 50);
    }
    const baseUrl = `${prefix}${base}`;

    const regexPattern = `^${baseUrl}\\d*${suffix}$`;

    const existingTeams = await this.db
      .collection<Team>(Collections.TEAM)
      .find({ hubUrl: { $regex: regexPattern, $options: "i" } })
      .project({ hubUrl: 1 })
      .toArray();

    const existingUrls = new Set(existingTeams.map((team) => team.hubUrl));
    const finalUrl = `${baseUrl}${suffix}`;

    if (!existingUrls.has(finalUrl)) {
      return finalUrl;
    }

    let counter = 1;
    while (existingUrls.has(`${baseUrl}${counter}${suffix}`)) {
      counter++;
    }

    return `${baseUrl}${counter}${suffix}`;
  }
}
