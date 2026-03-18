import { Injectable, Logger } from "@nestjs/common";
import { UserRepository } from "@src/modules/identity/repositories/user.repository";
import { TestflowRepository } from "../repositories/testflow.repository";
import { WorkspaceRepository } from "../repositories/workspace.repository";
import { CollectionRepository } from "../repositories/collection.repository";
import { EmailService } from "@src/modules/common/services/email.service";
import { ConfigService } from "@nestjs/config";
import { UpdatesRepository } from "../repositories/updates.repository";
import { UserInvitesRepository } from "@src/modules/identity/repositories/userInvites.repository";

@Injectable()
export class WeeklyDigestService {
  private static readonly QA_DIGEST_EMAIL = "sanil.nayak@techdome.net.in";

  constructor(
    private readonly userRepository: UserRepository,
    private readonly testflowRepository: TestflowRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly collectionRepository: CollectionRepository,
    private readonly updatesRepository: UpdatesRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly userInvitesRepository: UserInvitesRepository,
  ) {}

  private readonly logger = new Logger(WeeklyDigestService.name);

  async processWeeklyDigest() {
    this.logger.log("Processing weekly digest emails...");

    // const { start, end } = this.getLastWeekRange();
    // const { start: prevStart, end: prevEnd } = this.getPreviousWeekRange();
    const qaDigestEmail = WeeklyDigestService.QA_DIGEST_EMAIL;

    const end = new Date();
    const start = new Date(end.getTime() - 5 * 60 * 1000); // last 5 mins

    const prevEnd = new Date(start);
    const prevStart = new Date(prevEnd.getTime() - 5 * 60 * 1000);

    // Fetch users
    const users =
      await this.userRepository.getUsersForWeeklyDigest(qaDigestEmail);

    this.logger.log(`Total users found: ${users.length}`);

    if (users.length === 0) {
      this.logger.warn(`No users found with weekly digest enabled`);
      return;
    }

    // Workspace metric
    const [
      newWorkspaces,
      newCollections,
      apisCreated,
      testflowExecutions,
      activeWorkspaces,
      activityData,
      prevActivityData,
    ] = await Promise.all([
      this.workspaceRepository.getNewWorkspacesCount(start, end),
      this.collectionRepository.getNewCollectionsCount(start, end),
      this.collectionRepository.getApisCreatedCount(start, end),
      this.testflowRepository.getTestflowsExecutionCount(start, end),
      this.workspaceRepository.getActiveWorkspacesCount(start, end),
      this.updatesRepository.getWeeklyActivity(start, end),
      this.updatesRepository.getWeeklyActivity(prevStart, prevEnd),
    ]);

    const dailyExecutions = this.formatWeeklyGraph(activityData);
    const totalExecutions = dailyExecutions.reduce((a, b) => a + b, 0);

    const prevDailyExecutions = this.formatWeeklyGraph(prevActivityData);
    const previousCount = prevDailyExecutions.reduce((a, b) => a + b, 0);

    let percentChange = 0;

    if (previousCount === 0 && totalExecutions > 0) {
      percentChange = 100;
    } else if (previousCount > 0) {
      percentChange = Math.round(
        ((totalExecutions - previousCount) / previousCount) * 100,
      );
    }

    const graphHeights = this.normalizeGraphData(dailyExecutions);

    const max = Math.max(...graphHeights);

    const graph = graphHeights.map((height) => ({
      height,
      isMax: height === max,
    }));

    const transporter = this.emailService.createTransporter();
    const senderEmail = this.configService.get("app.senderEmail");
    const appUrl = this.configService.get("app.url");

    for (const user of users) {
      if (user.isWeeklyDigestEnabled === false) continue;
      const [updates, pendingInvites] = await Promise.all([
        this.updatesRepository.getUpdatesForEmail(
          start,
          end,
          user._id.toString(),
        ),
        this.userInvitesRepository.getPendingInvites(start, end, user.email),
      ]);

      const collaborationUpdates = updates.map((u) => u.message);

      const pendingActions = pendingInvites.map(
        (inv) => `Invitation sent to ${inv.email}`,
      );

      const unsubscribeLink = `${appUrl}/api/user/unsubscribe-weekly-digest?userId=${user._id}`;

      const mailOptions = {
        from: senderEmail,
        to: user.email,
        template: "weeklyDigestEmail",
        subject: "Your Weekly Digest 📊",

        headers: {
          "List-Unsubscribe": `<${unsubscribeLink}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        context: {
          userName: user.name || user.email,

          dateRange: `${start.toDateString()} - ${end.toDateString()}`,

          execution: {
            total: totalExecutions,
            percent: percentChange,
            graph,
          },

          metrics: {
            newWorkspaces,
            newCollections,
            apisCreated,
            testflowsExecuted: testflowExecutions,
            activeWorkspaces,
          },

          ctaLink: "https://sparrowapp.dev",
          collaborationUpdates,
          pendingActions,
          unsubscribeLink,
        },
      };

      await this.emailService.sendEmail(transporter, mailOptions);

      this.logger.log(`Weekly digest sent to ${user.email}`);
    }
  }

  private getLastWeekRange() {
    const now = new Date();

    // Start = last Monday
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - 6);
    start.setHours(0, 0, 0, 0);

    // End = last Sunday
    const end = new Date(now);
    end.setDate(now.getDate() - now.getDay());
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private getPreviousWeekRange() {
    const now = new Date();

    const end = new Date(now);
    end.setDate(now.getDate() - now.getDay() - 7);
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }

  async getExecutionTrend(
    userId: string,
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
    testflows: any[],
  ) {
    let currentCount = 0;
    let previousCount = 0;

    const dailyExecutions = Array(7).fill(0); // Mon → Sun

    for (const testflow of testflows) {
      if (!testflow.schedules) continue;

      for (const schedule of testflow.schedules) {
        if (!schedule.schedularRunHistory) continue;

        for (const run of schedule.schedularRunHistory) {
          const runDate = new Date(run.createdAt);

          const count = (run.successRequests || 0) + (run.failedRequests || 0);

          // Current week
          if (runDate >= currentStart && runDate <= currentEnd) {
            currentCount += count;

            const dayIndex = (runDate.getDay() + 6) % 7; // convert Sun=0 → Mon=0
            dailyExecutions[dayIndex] += count;
          }

          // Previous week
          if (runDate >= previousStart && runDate <= previousEnd) {
            previousCount += count;
          }
        }
      }
    }

    const percentChange =
      previousCount === 0
        ? currentCount > 0
          ? 100
          : 0
        : Math.round(((currentCount - previousCount) / previousCount) * 100);

    return {
      totalExecutions: currentCount,
      percentChange,
      dailyExecutions,
    };
  }

  private normalizeGraphData(data: number[]) {
    const max = Math.max(...data, 1);

    return data.map((value) => {
      if (max === 0) return 12;

      const height = Math.round((value / max) * 40);
      return height < 10 ? 10 : height;
    });
  }

  private formatWeeklyGraph(data: any[]) {
    const result = Array(7).fill(0);

    data.forEach((item) => {
      const mongoDay = item._id;
      const index = (mongoDay + 5) % 7;
      result[index] = item.count;
    });

    return result;
  }
}
