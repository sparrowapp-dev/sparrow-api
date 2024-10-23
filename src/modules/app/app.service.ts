import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpStatusCode } from "../common/enum/httpStatusCode.enum";
import { UpdaterJsonResponsePayload } from "./payloads/updaterJson.payload";
import {
  AuthModeEnum,
  BodyModeEnum,
  ItemTypeEnum,
  SourceTypeEnum,
} from "../common/models/collection.model";
import {
  AddTo,
  TransformedRequest,
} from "../common/models/collection.rxdb.model";
import { ContextService } from "../common/services/context.service";
import { Kafka } from "kafkajs";
import { MongoClient } from "mongodb";

/**
 * Application Service
 */
@Injectable()
export class AppService {
  private curlconverterPromise: any = null;
  private kafka: Kafka;
  private mongoClient: MongoClient;
  /**
   * Constructor
   * @param {ConfigService} config configuration service
   */
  constructor(
    private config: ConfigService,
    private contextService: ContextService,
  ) {}

  importCurlConverter() {
    if (!this.curlconverterPromise) {
      this.curlconverterPromise = import("curlconverter");
    }
    return this.curlconverterPromise;
  }

  getUpdaterDetails(currentVersion: string): UpdaterJsonResponsePayload {
    if (
      this.config.get("updater.updateAvailable") === "true" &&
      currentVersion < this.config.get("updater.appVersion")
    ) {
      const updatorJson = {
        version: this.config.get("updater.appVersion"),
        platforms: {
          "windows-x86_64": {
            signature: this.config.get("updater.windows.appSignature"),
            url: this.config.get("updater.windows.appUrl"),
          },
          "darwin-aarch64": {
            signature: this.config.get("updater.macAppleSilicon.appSignature"),
            url: this.config.get("updater.macAppleSilicon.appUrl"),
          },
          "darwin-x86_64": {
            signature: this.config.get("updater.macIntel.appSignature"),
            url: this.config.get("updater.macIntel.appUrl"),
          },
        },
      };
      return {
        statusCode: HttpStatusCode.OK,
        data: updatorJson,
      };
    }
    return {
      statusCode: HttpStatusCode.NO_CONTENT,
      data: null,
    };
  }

  async formatCurl(curlCommand: string) {
    curlCommand = curlCommand.replace(/^curl/i, "curl");

    // Remove extra spaces and line breaks
    curlCommand = curlCommand.replace(/\s+/g, " ").trim();

    return curlCommand;
  }

  async parseCurl(req: string): Promise<TransformedRequest> {
    try {
      const curlconverter = await this.importCurlConverter();
      const { toJsonString } = curlconverter;
      const curl = req as string;
      const updatedCurl = await this.formatCurl(curl);
      if (!curl || !curl.length) {
        throw new Error();
      }
      return this.transformRequest(JSON.parse(toJsonString(updatedCurl)));
    } catch (error) {
      console.error("Error parsing :", error);
      throw new BadRequestException("Invalid Curl");
    }
  }

  async handleFormatUrl(url: string): Promise<string> {
    url = url.replace(/^(https?:\/\/\s*)+(https?:\/\/)/, "$2");
    return url;
  }
  async transformRequest(requestObject: any): Promise<TransformedRequest> {
    const user = await this.contextService.get("user");
    const keyValueDefaultObj = {
      key: "",
      value: "",
      checked: false,
    };
    const formDataFileDefaultObj = {
      key: "",
      value: "",
      checked: false,
      base: "",
    };
    let method = requestObject.method.toUpperCase();
    if (
      method !== "GET" &&
      method !== "POST" &&
      method !== "PUT" &&
      method !== "PATCH" &&
      method !== "DELETE"
    ) {
      method = "INVALID";
    }
    const url = await this.handleFormatUrl(requestObject.url);
    const transformedObject: TransformedRequest = {
      name: url || "",
      description: "",
      type: ItemTypeEnum.REQUEST,
      source: SourceTypeEnum.USER,
      request: {
        method: method,
        url: url ?? "",
        body: {
          raw: "",
          urlencoded: [],
          formdata: {
            text: [],
            file: [],
          },
        },
        headers: [],
        queryParams: [],
        auth: {
          bearerToken: "",
          basicAuth: {
            username: "",
            password: "",
          },
          apiKey: {
            authKey: "",
            authValue: "",
            addTo: AddTo.Header,
          },
        },
        selectedRequestBodyType: BodyModeEnum["none"],
        selectedRequestAuthType: AuthModeEnum["No Auth"],
      },
      createdBy: user?.name,
      updatedBy: user?.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Handle URL with query parameters
    if (requestObject.queries) {
      const queryParams = [];
      for (const [key, value] of Object.entries(requestObject.queries)) {
        queryParams.push({ key, value, checked: true });
        if (
          key.toLowerCase() === "api-key" ||
          key.toLowerCase() === "x-api-key"
        ) {
          transformedObject.request.auth.apiKey = {
            authKey: key,
            authValue: value,
            addTo: AddTo.QueryParameter,
          };
          transformedObject.request.selectedRequestAuthType =
            AuthModeEnum["API Key"];
        }
      }
      transformedObject.request.url = url;
      transformedObject.request.queryParams = queryParams;
    }

    // Handle request body based on Content-Type
    if (requestObject.data) {
      const contentType =
        requestObject.headers["content-type"] ||
        requestObject.headers["Content-Type"] ||
        "";
      if (contentType.startsWith("multipart/form-data")) {
        const boundary = contentType.split("boundary=")[1];
        const formDataParts = requestObject.data.split(`--${boundary}\r\n`);
        formDataParts.shift(); // Remove the first boundary part

        for (const part of formDataParts) {
          const lines = part.trim().split("\r\n");
          const disposition = lines[0]; // Content-Disposition line
          if (disposition.includes('name="_method"')) {
            // Ignore the _method part
            continue;
          }
          const key = disposition.split('name="')[1].split('"')[0];
          let value = "";

          if (lines.length > 2) {
            value = lines.slice(2).join("\r\n").trim(); // Extract value from part content
          }

          if (value.includes(boundary)) {
            value = "";
          }

          if (disposition.includes('Content-Disposition: form-data; name="')) {
            transformedObject.request.body.formdata.text.push({
              key,
              value,
              checked: true,
            });
          } else if (
            disposition.includes(
              'Content-Disposition: form-data; name="file"',
            ) &&
            value.startsWith("/")
          ) {
            transformedObject.request.body.formdata.file.push({
              key,
              value,
              checked: true,
              base: `${value}`,
            });
          }
        }
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["multipart/form-data"];
      } else if (contentType.includes("application/json")) {
        try {
          transformedObject.request.body.raw = JSON.stringify(
            requestObject.data,
            null,
            2,
          );
        } catch (error) {
          console.warn("Error parsing request body JSON:", error);
          transformedObject.request.body.raw = requestObject.data;
        }
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["application/json"];
      } else if (contentType.includes("application/javascript")) {
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["application/javascript"];
      } else if (contentType.includes("text/html")) {
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["text/html"];
      } else if (
        contentType.includes("application/xml") ||
        contentType.includes("text/xml")
      ) {
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["application/xml"];
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        for (const [key, value] of new URLSearchParams(requestObject.data)) {
          transformedObject.request.body.urlencoded.push({
            key,
            value,
            checked: true,
          });
        }
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["application/x-www-form-urlencoded"];
      } else {
        console.warn(`Unsupported Content-Type: ${contentType}`);
        transformedObject.request.body.raw = JSON.stringify(
          requestObject?.data,
        );
        transformedObject.request.selectedRequestBodyType =
          BodyModeEnum["text/plain"];
      }
    }

    // Handle files from request object
    if (requestObject.files) {
      for (const [key, filename] of Object.entries(requestObject.files)) {
        transformedObject.request.body.formdata.file.push({
          key,
          value: filename,
          checked: true,
          base: `${filename}`,
        });
      }
    }

    // Handle headers and populate auth details
    if (requestObject.headers) {
      for (const [key, value] of Object.entries(requestObject.headers)) {
        transformedObject.request.headers.push({ key, value, checked: true });

        // Check for Bearer token
        if (
          key.toLowerCase() === "authorization" &&
          typeof value === "string" &&
          (value.startsWith("bearer ") || value.startsWith("Bearer "))
        ) {
          transformedObject.request.auth.bearerToken = value.slice(7).trim();
          transformedObject.request.selectedRequestAuthType =
            AuthModeEnum["Bearer Token"];
        }

        // Check for API key
        if (
          key.toLowerCase() === "api-key" ||
          key.toLowerCase() === "x-api-key"
        ) {
          transformedObject.request.auth.apiKey = {
            authKey: key,
            authValue: value,
            addTo: AddTo.Header,
          };
          transformedObject.request.selectedRequestAuthType =
            AuthModeEnum["API Key"];
        }

        // Check for Basic Auth
        if (
          key.toLowerCase() === "authorization" &&
          typeof value === "string" &&
          (value.startsWith("basic ") || value.startsWith("Basic "))
        ) {
          const decodedValue = Buffer.from(value.slice(6), "base64").toString(
            "utf8",
          );
          const [username, password] = decodedValue.split(":");
          transformedObject.request.auth.basicAuth = {
            username,
            password,
          };
          transformedObject.request.selectedRequestAuthType =
            AuthModeEnum["Basic Auth"];
        }
      }
    }

    //Assign default values
    if (!transformedObject.request.headers.length) {
      transformedObject.request.headers.push(keyValueDefaultObj);
    }
    if (!transformedObject.request.queryParams.length) {
      transformedObject.request.queryParams.push(keyValueDefaultObj);
    }
    if (!transformedObject.request.body.formdata.text.length) {
      transformedObject.request.body.formdata.text.push(keyValueDefaultObj);
    }
    if (!transformedObject.request.body.formdata.file.length) {
      transformedObject.request.body.formdata.file.push(formDataFileDefaultObj);
    }
    if (!transformedObject.request.body.urlencoded.length) {
      transformedObject.request.body.urlencoded.push(keyValueDefaultObj);
    }

    return transformedObject;
  }

  /**
   * Checks the connection to the Kafka broker.
   *
   * This method attempts to create an admin client and connect to the Kafka broker.
   * If the connection is successful, the client is disconnected and the method returns `true`.
   * If the connection fails, the error is logged, and the method returns `false`.
   *
   * @returns {Promise<boolean>} - A promise that resolves to `true` if the connection is successful, or `false` if it fails.
   */
  async checkKafkaConnection(): Promise<boolean> {
    try {
      this.kafka = new Kafka({
        brokers: [this.config.get("kafka.broker")],
      });
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.disconnect();
      return true;
    } catch (error) {
      console.error("Kafka connection error:", error);
      return false;
    }
  }

  /**
   * Checks the connection to the MongoDB database.
   *
   * This method attempts to create a client and connect to the MongoDB server.
   * It sends a ping to the server to verify the connection. If the connection is successful,
   * the client is closed and the method returns `true`. If the connection fails, the error is logged,
   * and the method returns `false`.
   *
   * @returns {Promise<boolean>} - A promise that resolves to `true` if the connection is successful, or `false` if it fails.
   */
  async checkMongoConnection(): Promise<boolean> {
    try {
      this.mongoClient = new MongoClient(this.config.get("db.url"));
      await this.mongoClient.connect();
      await this.mongoClient.db().admin().ping();
      await this.mongoClient.close();
      return true;
    } catch (error) {
      console.error("MongoDB connection error:", error);
      return false;
    }
  }
}
