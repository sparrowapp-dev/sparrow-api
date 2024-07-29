import * as nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class EmailService {
  constructor(private configService: ConfigService) {}

  createTransporter() {
    const transporter = nodemailer.createTransport({
      host: this.configService.get("app.mailHost"),
      port: this.configService.get("app.mailPort"),
      secure: this.configService.get("app.mailSecure") === "true",
      auth: {
        user: this.configService.get("app.userName"),
        pass: this.configService.get("app.senderPassword"),
      },
    });

    const handlebarOptions = {
      viewEngine: {
        extname: ".handlebars",
        partialsDir: path.resolve(__dirname, "..", "..", "views", "partials"),
        layoutsDir: path.resolve(__dirname, "..", "..", "views", "layouts"),
        defaultLayout: "main",
      },
      viewPath: path.resolve(__dirname, "..", "..", "views"),
      extName: ".handlebars",
    };

    transporter.use("compile", hbs(handlebarOptions));

    return transporter;
  }
}
