import {
  AuthModeEnum,
  BodyModeEnum,
  ItemTypeEnum,
  SourceTypeEnum,
  PostmanBodyModeEnum,
  CollectionAuthModeEnum,
  RequestTestCases,
} from "./collection.model";

export enum AddTo {
  Header = "Header",
  QueryParameter = "Query Parameter",
}

export enum AddOAuth2To {
  Header = "Header",
  QueryParameter = "Query Parameter",
}

export enum GrantTypeOAuth2 {
  AUTHORIZATION_CODE = "authorization_code",
  CLIENT_CREDENTIALS = "client_credentials",
  PASSWORD = "password",
  REFRESH_TOKEN = "refresh_token",
  IMPLICIT = "implicit",
}

export interface OAuth2Token {
  id: string;
  name: string;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string[];
  createdAt?: Date;
  expiresAt?: Date;
  add: AddOAuth2To;
}

export interface OAuth2Configuration {
  tokenName: string;
  clientId: string;
  clientSecret: string;
  AuthUrl?: string;
  AccessTokenUrl?: string;
  callbackUrl: string;
  state?: string;
  scopes?: string[];
  grantType?: GrantTypeOAuth2;
  addTo: AddOAuth2To;
}

export class TransformedRequest {
  id?: string;
  tag?: string;
  operationId?: string;
  source: SourceTypeEnum;
  isDeleted?: boolean;
  name: string;
  description?: string;
  type: ItemTypeEnum;
  request: SparrowRequest;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  items?: TransformedRequest[];
}

export interface SparrowRequest {
  selectedRequestBodyType?: BodyModeEnum | PostmanBodyModeEnum;
  selectedRequestAuthType?: AuthModeEnum;
  selectedRequestAuthProfileId?: string;
  method: string;
  url: string;
  body: SparrowRequestBody;
  headers?: KeyValue[];
  queryParams?: KeyValue[];
  auth?: Auth;
  tests?: RequestTestCases;
}

// Define the RequestBody type
export class SparrowRequestBody {
  raw?: string;
  urlencoded?: KeyValue[];
  formdata?: FormData;
}

interface FormData {
  text: KeyValue[];
  file: FormDataFileEntry[];
}

export class KeyValue {
  key: string;
  value: string | unknown;
  checked: boolean;
}

interface FormDataFileEntry {
  key: string;
  value: string | unknown;
  checked: boolean;
  base: string;
}

export class Auth {
  bearerToken?: string;
  basicAuth?: {
    username: string;
    password: string;
  };
  apiKey?: {
    authKey: string;
    authValue: string | unknown;
    addTo: AddTo;
  };
  oAuth2?: {
    tokens: OAuth2Token[];
    configuration: OAuth2Configuration;
    selectToken?: string;
  };
}

export class AuthProfiles extends Auth {
  authId?: string;
  name?: string;
  description?: string;
  authType?: CollectionAuthModeEnum;
  createdAt?: Date;
  defaultKey?: boolean;
}
