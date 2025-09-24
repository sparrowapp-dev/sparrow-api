/* eslint-disable @typescript-eslint/no-explicit-any */
import JSON5 from "json5";
import {
  type KeyValue,
  RequestDataTypeEnum,
} from "../enum/http-request-base.enum";

/**
 * Updated RequestData interface for the new structure
 */
interface RequestData {
  headers?: Array<{ key: string; value: string; checked: boolean }>;
  queryParams?: Array<{ key: string; value: string; checked: boolean }>;
  body?: {
    raw?: string;
    urlencoded?: Array<{ key: string; value: string; checked: boolean }>;
    formdata?: {
      text?: Array<{ key: string; value: string; checked: boolean }>;
      file?: Array<{
        key: string;
        value?: string;
        base?: string;
        checked?: boolean;
      }>;
    };
  };
  auth?: {
    bearerToken?: string;
    basicAuth?: {
      username: string;
      password: string;
    };
    apiKey?: {
      authKey: string;
      authValue: string;
      addTo: string;
    };
  };
  url: string;
  method: string;
  name: string;
  selectedRequestBodyType?: string;
  selectedRequestAuthType?: string;
}

/**
 * DecodeTestflow - Updated for new RequestData structure
 *
 * Parses requests (URL, headers, body, content-type) for testflow execution.
 * Designed for Node/Next.js backend. Uses JSON5 for permissive JSON parsing of raw bodies.
 */
class DecodeTestflow {
  constructor() {}

  /**
   * Determine response content type enum from response headers.
   */
  public setResponseContentType = (
    responseHeaders: KeyValue[] | undefined,
  ): RequestDataTypeEnum => {
    if (!responseHeaders) return RequestDataTypeEnum.TEXT;

    for (let i = 0; i < responseHeaders.length; i++) {
      const key = (responseHeaders[i].key || "").toLowerCase();
      const value = String(responseHeaders[i].value || "");
      if (key === "content-type") {
        if (value.includes("text/html")) return RequestDataTypeEnum.HTML;
        if (
          value.includes("application/json") ||
          value.includes("application/hal+json")
        )
          return RequestDataTypeEnum.JSON;
        if (value.includes("application/xml")) return RequestDataTypeEnum.XML;
        if (value.includes("application/javascript"))
          return RequestDataTypeEnum.JAVASCRIPT;
        if (value.startsWith("image/")) return RequestDataTypeEnum.IMAGE;
        return RequestDataTypeEnum.TEXT;
      }
    }
    return RequestDataTypeEnum.TEXT;
  };

  /**
   * Ensure URL has protocol; handles protocol-relative URLs.
   */
  private ensureHttpOrHttps = (str: string): string => {
    if (!str) return "http://";
    if (str.startsWith("http://") || str.startsWith("https://")) {
      return "";
    } else if (str.startsWith("//")) {
      return "http:";
    } else {
      return "http://";
    }
  };

  /**
   * Return only checked KeyValue entries (preserves order).
   */
  private extractKeyValue = (
    pairs?: Array<{ key: string; value: string; checked: boolean }>,
  ): KeyValue[] => {
    if (!Array.isArray(pairs)) return [];
    const checkedPairs: KeyValue[] = [];
    for (const pair of pairs) {
      if (pair && pair.checked && pair.key) {
        checkedPairs.push({ key: pair.key, value: String(pair.value || "") });
      }
    }
    return checkedPairs;
  };

  /**
   * Build URL with query parameters and authentication parameters (if any).
   */
  private extractURL = (
    requestData: RequestData,
    environmentVariables: any[] = [],
    previousResponse?: any,
  ): string => {
    let url = (requestData.url || "").trim();

    // Replace environment variables in URL
    url = this.setEnvironmentVariables(url, environmentVariables);
    url = this.setDynamicExpression(url, previousResponse);

    // Add query parameters
    const queryParams = this.extractKeyValue(requestData.queryParams);
    if (queryParams.length > 0) {
      const processedParams = queryParams.map((param) => ({
        key: this.setEnvironmentVariables(param.key, environmentVariables),
        value: this.setEnvironmentVariables(
          String(param.value),
          environmentVariables,
        ),
      }));

      const queryString = processedParams
        .map(
          (param) =>
            `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`,
        )
        .join("&");

      const hasQuery = url.includes("?");
      url = `${url}${hasQuery ? "&" : "?"}${queryString}`;
    }

    // Handle API Key in query parameters
    if (
      requestData.selectedRequestAuthType === "API Key" &&
      requestData.auth?.apiKey?.addTo === "Query" &&
      requestData.auth?.apiKey?.authKey &&
      requestData.auth?.apiKey?.authValue
    ) {
      const processedKey = this.setEnvironmentVariables(
        requestData.auth.apiKey.authKey,
        environmentVariables,
      );
      const processedValue = this.setEnvironmentVariables(
        requestData.auth.apiKey.authValue,
        environmentVariables,
      );

      const hasQuery = url.includes("?");
      url = `${url}${hasQuery ? "&" : "?"}${encodeURIComponent(processedKey)}=${encodeURIComponent(processedValue)}`;
    }

    return this.ensureHttpOrHttps(url) + url;
  };

  /**
   * Process authentication and return auth header if needed.
   */
  private processAuthentication = (
    requestData: RequestData,
    environmentVariables: any[] = [],
  ): KeyValue | null => {
    const authType = requestData.selectedRequestAuthType;
    const auth = requestData.auth;

    if (!auth) return null;

    switch (authType) {
      case "Bearer Token":
        if (auth.bearerToken) {
          const processedToken = this.setEnvironmentVariables(
            auth.bearerToken,
            environmentVariables,
          );
          return {
            key: "Authorization",
            value: `Bearer ${processedToken}`,
          };
        }
        break;

      case "Basic Auth":
        if (auth.basicAuth?.username && auth.basicAuth?.password) {
          const processedUsername = this.setEnvironmentVariables(
            auth.basicAuth.username,
            environmentVariables,
          );
          const processedPassword = this.setEnvironmentVariables(
            auth.basicAuth.password,
            environmentVariables,
          );
          const credentials = Buffer.from(
            `${processedUsername}:${processedPassword}`,
          ).toString("base64");
          return {
            key: "Authorization",
            value: `Basic ${credentials}`,
          };
        }
        break;

      case "API Key":
        if (
          auth.apiKey?.addTo === "Header" &&
          auth.apiKey?.authKey &&
          auth.apiKey?.authValue
        ) {
          const processedKey = this.setEnvironmentVariables(
            auth.apiKey.authKey,
            environmentVariables,
          );
          const processedValue = this.setEnvironmentVariables(
            auth.apiKey.authValue,
            environmentVariables,
          );
          return {
            key: processedKey,
            value: processedValue,
          };
        }
        break;

      case "No Auth":
      default:
        return null;
    }

    return null;
  };

  /**
   * Extract and process headers, including authentication headers.
   */
  private extractHeaders = (
    requestData: RequestData,
    environmentVariables: any[] = [],
    previousResponse?: any,
  ): string => {
    // Get regular headers
    const headers = this.extractKeyValue(requestData.headers);
    // Process environment variables in headers
    const processedHeaders = headers.map((header) => ({
      key: this.setEnvironmentVariables(header.key, environmentVariables),
      value: this.setEnvironmentVariables(
        String(header.value),
        environmentVariables,
      ),
    }));
    // Get authentication header
    const authHeader = this.processAuthentication(
      requestData,
      environmentVariables,
    );
    if (authHeader) {
      processedHeaders.unshift(authHeader);
    }
    // Remove duplicates (keep first occurrence) and filter empty keys
    const uniqueHeaders = new Map<string, string>();
    for (const header of processedHeaders) {
      const key = header.key.toLowerCase();
      if (key && !uniqueHeaders.has(key) && key !== "content-length") {
        uniqueHeaders.set(key, header.value);
      }
    }

    // Convert back to array format
    const result = Array.from(uniqueHeaders.entries()).map(([key, value]) => ({
      key,
      value,
    }));

    // Apply dynamic expressions
    const jsonString = JSON.stringify(result);
    const processed = this.setDynamicExpression(jsonString, previousResponse);

    return processed;
  };

  /**
   * Extract and format the request body based on body type.
   */
  private extractBody = (
    requestData: RequestData,
    environmentVariables: any[] = [],
    previousResponse?: any,
  ): string => {
    const bodyType = requestData.selectedRequestBodyType;
    const body = requestData.body;

    if (!body) return "";

    switch (bodyType) {
      case "raw":
        const rawText = this.setEnvironmentVariables(
          body.raw || "",
          environmentVariables,
        );
        if (!rawText || rawText.trim() === "") return "{}";

        const evaluated = this.setDynamicExpression2(rawText, previousResponse);
        if (evaluated === "") return "{}";

        // Try to parse as JSON for formatting
        try {
          const parsed = JSON5.parse(evaluated);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return evaluated;
        }

      case "urlencoded":
        const urlencodedData = this.extractKeyValue(body.urlencoded);
        const processedUrlencoded = urlencodedData.map((item) => ({
          key: this.setEnvironmentVariables(item.key, environmentVariables),
          value: this.setEnvironmentVariables(
            String(item.value),
            environmentVariables,
          ),
        }));

        const urlEncodedJson = JSON.stringify(processedUrlencoded);
        return this.setDynamicExpression(urlEncodedJson, previousResponse);

      case "formdata":
        const formDataItems: any[] = [];

        // Add text fields
        if (body.formdata?.text) {
          const textFields = this.extractKeyValue(body.formdata.text);
          textFields.forEach((field) => {
            formDataItems.push({
              key: this.setEnvironmentVariables(
                field.key,
                environmentVariables,
              ),
              value: this.setEnvironmentVariables(
                String(field.value),
                environmentVariables,
              ),
              type: "text",
            });
          });
        }

        // Add file fields
        if (body.formdata?.file) {
          body.formdata.file.forEach((field) => {
            if (field.checked !== false) {
              // default to true if not specified
              formDataItems.push({
                key: this.setEnvironmentVariables(
                  field.key || "",
                  environmentVariables,
                ),
                value: field.value || "",
                base: field.base || "",
                type: "file",
              });
            }
          });
        }

        return this.setDynamicExpression(
          JSON.stringify(formDataItems),
          previousResponse,
        );

      case "none":
      default:
        return "";
    }
  };

  /**
   * Map body type to content type.
   */
  private extractDataType = (requestData: RequestData): string => {
    const bodyType = requestData.selectedRequestBodyType;

    switch (bodyType) {
      case "raw":
        return "application/json";
      case "urlencoded":
        return "application/x-www-form-urlencoded";
      case "formdata":
        return "multipart/form-data";
      case "none":
      default:
        return "text/plain";
    }
  };

  /**
   * Replace environment variables in the text. Uses {{KEY}} syntax.
   */
  public setEnvironmentVariables = (
    text: string,
    environmentVariables: any[] = [],
  ): string => {
    if (typeof text !== "string") return String(text || "");
    let updatedText = text.replace(
      /\[\*\$\[(.*?)\]\$\*\]/gs,
      (_, squareContent) => {
        const updated = squareContent
          .replace(/\\/g, "")
          .replace(/"/g, `'`)
          .replace(/\{\{(.*?)\}\}/g, (_:any, inner: string) => {
            return `'{{${inner.trim()}}}'`;
          });
        return `[*$[${updated}]$*]`;
      },
    );

    if (!Array.isArray(environmentVariables)) environmentVariables = [];

    for (const element of environmentVariables) {
      if (!element || typeof element.key !== "string" || !element.checked)
        continue;
      const keyEscaped = element.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`{{(${keyEscaped})}}`, "g");
      updatedText = updatedText.replace(regex, String(element.value ?? ""));
    }

    return updatedText;
  };

  /**
   * Evaluate dynamic expressions inside the special wrapper [*$[ ... ]$*]
   */
  private setDynamicExpression = (text: string, response: any): string => {
    if (!text || typeof text !== "string") return String(text || "");
    const result = text.replace(/\[\*\$\[(.*?)\]\$\*\]/gs, (_, expr) => {
      try {
        const de = expr.replace(/'\{\{(.*?)\}\}'/g, "undefined");
        const fn = new Function(
          "response",
          `with (response) { return (${de}); }`,
        );
        const s = fn(response);
        if (typeof s === "string") {
          return s
            .replace(/\n/g, "")
            .replace(/\\/g, "\\\\")
            .replace(/\"/g, '\\"')
            .replace(/\t/g, "\\t");
        } else {
          return String(s);
        }
      } catch (e: any) {
        return "";
      }
    });
    return result;
  };

  /**
   * Similar to setDynamicExpression but returns properly quoted JSON-safe values.
   */
  public setDynamicExpression2 = (text: string, response: any): string => {
    if (!text || typeof text !== "string") return String(text || "");
    const result = text.replace(/\[\*\$\[(.*?)\]\$\*\]/gs, (_, expr) => {
      try {
        const de = expr.replace(/'\{\{(.*?)\}\}'/g, "undefined");
        const fn = new Function(
          "response",
          `with (response) { return (${de}); }`,
        );
        const s = fn(response);
        if (typeof s === "string") return `"${s}"`;
        if (typeof s === "object" && s !== null) return `${JSON.stringify(s)}`;
        return String(s);
      } catch (e: any) {
        return "";
      }
    });
    return result;
  };

  /**
   * Entry point - returns [url, method, headers, body, contentType]
   * Updated to work with new RequestData structure
   */
  public init(
    requestData: RequestData,
    environmentVariables: any[] = [],
    previousResponse?: any,
  ): string[] {
    const url = this.extractURL(
      requestData,
      environmentVariables,
      previousResponse,
    );

    const method = (requestData.method || "GET").toUpperCase();

    const headers = this.extractHeaders(
      requestData,
      environmentVariables,
      previousResponse,
    );

    const body = this.extractBody(
      requestData,
      environmentVariables,
      previousResponse,
    );

    const contentType = this.extractDataType(requestData);

    return [url, method, headers, body, contentType];
  }
}

export { DecodeTestflow, type RequestData };
