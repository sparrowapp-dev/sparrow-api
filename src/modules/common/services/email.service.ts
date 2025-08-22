import * as nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import SMTPTransport from "nodemailer/lib/smtp-transport";

interface MailOptions {
  from: string;
  to: string;
  text?: string;
  template?: string;
  context?: {
    [key: string]: any;
  };
  subject: string;
  attachments?: {
    filename: string;
    content: any;
  }[];
}

@Injectable()
export class EmailService {
  constructor(private configService: ConfigService) {}

  createTransporter(useTemplate = true) {
    const transporter = nodemailer.createTransport({
      host: this.configService.get("app.mailHost"),
      port: this.configService.get("app.mailPort"),
      secure: this.configService.get("app.mailSecure") === "true",
      auth: {
        user: this.configService.get("app.userName"),
        pass: this.configService.get("app.senderPassword"),
      },
    });

    if (useTemplate) {
      const handlebarOptions = {
        viewEngine: {
          extname: ".handlebars",
          partialsDir: path.resolve(__dirname, "..", "..", "views", "partials"),
          layoutsDir: path.resolve(__dirname, "..", "..", "views", "layouts"),
          defaultLayout: "main",
          helpers: {
            linkedinUrl: () => this.configService.get("social.linkedinUrl"),
            githubUrl: () => this.configService.get("social.githubUrl"),
            discordUrl: () => this.configService.get("social.discordUrl"),
          },
        },
        viewPath: path.resolve(__dirname, "..", "..", "views"),
        extName: ".handlebars",
      };

      transporter.use("compile", hbs(handlebarOptions));
    }

    return transporter;
  }

  async sendEmail(
    transporter: nodemailer.Transporter<
      SMTPTransport.SentMessageInfo,
      SMTPTransport.Options
    >,
    mailOptions: MailOptions,
  ): Promise<any> {
    const smtpEnabled = this.configService.get("app.smtpEnabled");

    // Exit early if SMTP is disabled
    if (smtpEnabled !== "true") {
      console.warn("SMTP is disabled. Email not sent.");
      return;
    }

    try {
      const result = await transporter.sendMail(mailOptions);
      return result; // Return the result for further processing if needed
    } catch (error) {
      console.error("Failed to send email:", error);
    }
  }
}
