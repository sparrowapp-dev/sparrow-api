export enum requestBodyType {
  FORMDATA = "Form Data",
  URLENCODED = "URL Encoded",
  RAW = "Raw",
  BINARY = "Binary",
  NONE = "None",
}

export enum requestBodyLangType {
  JSON = "JSON",
  XML = "XML",
  HTML = "HTML",
  TEXT = "Text",
  JAVASCRIPT = "JavaScript",
  IMAGE = "Image",
}

export enum MockDataRequestType {
  PARAMETERS = "Parameters",
  AUTHORIZATION = "Authorization",
  HEADERS = "Headers",
  REQUEST_BODY = "Request Body",
}

export enum CollectionRequestAddToBaseEnum {
  HEADER = "Header",
  QUERY_PARAMETER = "Query Parameter",
  COOKIES = "Cookies",
}

export enum CollectionAuthTypeBaseEnum {
  NO_AUTH = "No Auth",
  API_KEY = "API Key",
  BEARER_TOKEN = "Bearer Token",
  BASIC_AUTH = "Basic Auth",
}

export enum CollectionTypeBaseEnum {
  MOCK = "MOCK",
  STANDARD = "STANDARD",
}

export interface CollectionAuthBaseInterface {
  bearerToken: string;
  basicAuth: {
    username: string;
    password: string;
  };
  apiKey: {
    authKey: string;
    authValue: string;
    addTo: CollectionRequestAddToBaseEnum;
  };
}