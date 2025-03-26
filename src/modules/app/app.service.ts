import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
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
import axios from "axios";
import { AppRepository } from "./app.repository";
import { KafkajsProducer } from "../common/services/kafka/kafkajs.producer";

/**
 * Application Service
 */
@Injectable()
export class AppService {
  private curlconverterPromise: any = null;
  private kafka: Kafka;
  /**
   * Constructor
   * @param {ConfigService} config configuration service
   */
  constructor(
    private config: ConfigService,
    private contextService: ContextService,
    private readonly appRepository: AppRepository,
  ) {}

  importCurlConverter() {
    if (!this.curlconverterPromise) {
      this.curlconverterPromise = import("curlconverter");
    }
    return this.curlconverterPromise;
  }

  isVersionGreater(v1: string, v2: string) {
    if (v1 && v2) {
      const v1Parts = v1?.split(".")?.map(Number);
      const v2Parts = v2?.split(".")?.map(Number);

      for (let i = 0; i < Math.max(v1Parts?.length, v2Parts?.length); i++) {
        const v1Part = v1Parts[i] || 0; // default to 0 if part is missing
        const v2Part = v2Parts[i] || 0;

        if (v1Part > v2Part) return true;
        if (v1Part < v2Part) return false;
      }
    }

    return false; // versions are equal
  }

  getUpdaterDetails(currentVersion: string): UpdaterJsonResponsePayload {
    if (
      this.config.get("updater.updateAvailable") === "true" &&
      this.isVersionGreater(
        this.config.get("updater.appVersion"),
        currentVersion,
      )
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
      const stringifiedCurl = toJsonString(updatedCurl);
      const parsedCurl = JSON.parse(stringifiedCurl);
      // Match all -F flags with their key-value pairs
      const formDataMatches = curl.match(/-F\s+'([^=]+)=@([^;]+)/g);
      const formDataItems = formDataMatches
        ? formDataMatches.map((match) => {
            // Extract key and filename
            const [, keyValue] = match.split("-F '");
            const [key, filePath] = keyValue.split("=@");
            const value = filePath.replace(/'/g, "");

            return {
              key,
              value,
              checked: true,
              base: value,
            };
          })
        : [];

      // Override the form data in second
      if (formDataItems.length > 0) {
        parsedCurl.files = formDataItems;
      }
      return this.transformRequest(parsedCurl);
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
    let isFormData = false;

    // Handle request body based on Content-Type
    if (requestObject?.data || requestObject?.files) {
      const contentType =
        requestObject.headers["content-type"] ||
        requestObject.headers["Content-Type"] ||
        "";
      if (contentType.startsWith("multipart/form-data")) {
        isFormData = true;
        const boundary = contentType.split("boundary=")[1];
        if (contentType.includes("boundary=")) {
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

            if (
              disposition.includes('Content-Disposition: form-data; name="')
            ) {
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
              transformedObject.request.body.formdata.text.push({
                key,
                value: "",
                checked: true,
              });
            }
          }
        } else {
          // Handle case where no boundary is present
          try {
            // Try to parse the body data
            const bodyData =
              typeof requestObject.data === "string"
                ? JSON.parse(requestObject.data)
                : requestObject.data;

            // If bodyData is an object, convert its key-value pairs
            if (typeof bodyData === "object" && bodyData !== null) {
              Object.entries(bodyData).forEach(([key, value]) => {
                // Check if the value appears to be a file path
                if (typeof value === "string" && value.startsWith("/")) {
                  transformedObject.request.body.formdata.text.push({
                    key,
                    value: "",
                    checked: true,
                  });
                } else {
                  transformedObject.request.body.formdata.text.push({
                    key,
                    value: String(value),
                    checked: true,
                  });
                }
              });
            }
          } catch (error) {
            // If parsing fails, try to handle it as a plain string
            if (typeof requestObject.data === "string") {
              // Split by common form data delimiters
              const pairs = requestObject.data.split(/[&\n]/).filter(Boolean);
              pairs.forEach((pair: any) => {
                const [key, value] = pair.split("=").map(decodeURIComponent);
                if (value && value.startsWith("/")) {
                  transformedObject.request.body.formdata.text.push({
                    key,
                    value: "",
                    checked: true,
                  });
                } else {
                  transformedObject.request.body.formdata.text.push({
                    key,
                    value: value || "",
                    checked: true,
                  });
                }
              });
            }
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
      // If files is an array of objects
      if (Array.isArray(requestObject.files)) {
        requestObject.files.forEach((fileObj: any) => {
          transformedObject.request.body.formdata.text.push({
            key: fileObj?.key || "",
            value: "",
            checked: true,
          });
        });
      }
      // If files is an object with key-value pairs
      else {
        for (const [key, filename] of Object.entries(requestObject.files)) {
          transformedObject.request.body.formdata.text.push({
            key,
            value: "",
            checked: true,
          });
        }
      }
    }

    // Handle headers and populate auth details
    if (requestObject.headers) {
      for (const [key, value] of Object.entries(requestObject.headers)) {
        if (!(isFormData && key === "Content-Type")) {
          transformedObject.request.headers.push({ key, value, checked: true });
        }

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
      transformedObject.request.headers.push(keyValueDefaultObj);
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
    const kafkaBroker = [this.config.get("kafka.broker")];
    const producer = new KafkajsProducer("health-check", kafkaBroker);
    const isKafkaConnected = await producer.isKafkaConnected();
    return isKafkaConnected;
  }

  /**
   * Checks the connection to the MongoDB database.
   *
   * This method sends a ping to the server to verify the connection. If the connection is successful,
   * the method returns `true`. If the connection fails, the error is logged,
   * and the method returns `false`.
   *
   * @returns {Promise<boolean>} - A promise that resolves to `true` if the connection is successful, or `false` if it fails.
   */
  async checkMongoConnection(): Promise<boolean> {
    const isDBConnected = await this.appRepository.isMongoConnected();
    return isDBConnected;
  }

  /**Users can subscribe to Sparrow through email. This is for Sparrow-docs.*/
  async subscribeToBeehiiv(email: string): Promise<any> {
    if (!email) {
      throw new BadRequestException("Please provide an email to subscribe.");
    }
    const beehiivPublicationId = this.config.get("docs.beehiivPublicationId");
    const beehiivApiKey = this.config.get("docs.beehiivApiKey");
    if (!beehiivPublicationId || !beehiivApiKey) {
      throw new InternalServerErrorException(
        "Beehiiv configuration is missing.",
      );
    }
    const url = `https://api.beehiiv.com/v2/publications/${beehiivPublicationId}/subscriptions`;
    try {
      const response = await axios.post(
        url,
        {
          email,
          reactivate_existing: false,
          send_welcome_email: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${beehiivApiKey}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        throw new InternalServerErrorException(
          "An error occurred while subscribing.",
        );
      } else {
        throw new BadRequestException("Request Failed");
      }
    }
  }
}
