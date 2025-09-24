export enum HttpRequestAuthTypeBaseEnum {
  NO_AUTH = "No Auth",
  API_KEY = "API Key",
  BEARER_TOKEN = "Bearer Token",
  BASIC_AUTH = "Basic Auth",
  INHERIT_AUTH = "Inherit Auth",
  AUTH_PROFILES = "Authentication Profiles",
}

export enum HttpRequestMethodBaseEnum {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
  HEAD = "HEAD",
  OPTIONS = "OPTIONS",
}

export interface KeyWrapper {
  key: string;
}

export interface ValueWrapper {
  value: string;
}

export enum RequestDatasetEnum {
  FORMDATA = "Form Data",
  URLENCODED = "URL Encoded",
  RAW = "Raw",
  BINARY = "Binary",
  NONE = "None",
}

export enum FormDataTypeEnum {
  TEXT = "text",
  FILE = "file",
}

export enum RequestMethodEnum {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
  HEAD = "HEAD",
  OPTIONS = "OPTIONS",
}

export enum CollectionRequestAddToBaseEnum {
  HEADER = "Header",
  QUERY_PARAMETER = "Query Parameter",
  COOKIES = "Cookies",
}

export interface KeyValue extends KeyWrapper, ValueWrapper {}

export interface CheckedWrapper {
  checked: boolean;
}

export interface KeyValueChecked
  extends KeyWrapper,
    ValueWrapper,
    CheckedWrapper {}

export interface UrlEncodedWrapper {
  urlencoded: KeyValueChecked[];
}

export interface BaseWrapper {
  base: string;
}
export interface RawWrapper {
  raw: string;
}

export interface TypeWrapper2 {
  type: FormDataTypeEnum;
}

export interface FormData
  extends KeyWrapper,
    ValueWrapper,
    BaseWrapper,
    CheckedWrapper,
    TypeWrapper2 {}
export interface FormDataWrapper {
  formdata: FormData[];
}
export interface Body extends RawWrapper, UrlEncodedWrapper, FormDataWrapper {}

export interface BodyWrapper {
  body: Body;
}

export interface QueryParamsWrapper {
  queryParams: KeyValueChecked[];
}

export interface MethodWrapper {
  method: RequestMethodEnum;
}

export interface UrlWrapper {
  url: string;
}

export interface HeadersWrapper {
  headers: KeyValueChecked[];
}

export interface BearerTokenWrapper {
  bearerToken: string;
}
export interface UsernameWrapper {
  username: string;
}
export interface PasswordWrapper {
  password: string;
}
export interface BasicAuth extends UsernameWrapper, PasswordWrapper {}
export interface BasicAuthWrapper {
  basicAuth: BasicAuth;
}
export interface AddtoWrapper {
  addTo: CollectionRequestAddToBaseEnum;
}
export interface AuthKeyWrapper {
  authKey: string;
}
export interface AuthValueWrapper {
  authValue: string;
}
export interface ApiKey
  extends AuthKeyWrapper,
    AuthValueWrapper,
    AddtoWrapper {}
export interface ApiKeyWrapper {
  apiKey: ApiKey;
}

export interface Auth
  extends BearerTokenWrapper,
    BasicAuthWrapper,
    ApiKeyWrapper {}

export interface AuthWrapper {
  auth: Auth;
}

export enum RequestDataTypeEnum {
  JSON = "JSON",
  XML = "XML",
  HTML = "HTML",
  TEXT = "Text",
  JAVASCRIPT = "JavaScript",
  IMAGE = "Image",
}

export interface Request
  extends MethodWrapper,
    BodyWrapper,
    QueryParamsWrapper,
    UrlWrapper,
    HeadersWrapper {}
