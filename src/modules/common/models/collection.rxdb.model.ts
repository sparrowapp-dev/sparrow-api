import {
  AuthModeEnum,
  BodyModeEnum,
  ItemTypeEnum,
  PostmanBodyModeEnum,
  SourceTypeEnum,
} from "./collection.model";

export enum AddTo {
  Header = "Header",
  QueryParameter = "Query Parameter",
}

export interface TransformedRequest {
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
  method: string;
  url: string;
  body: SparrowRequestBody;
  headers?: KeyValue[];
  queryParams?: KeyValue[];
  auth?: Auth;
}

// Define the RequestBody type
export interface SparrowRequestBody {
  raw?: string;
  urlencoded?: KeyValue[];
  formdata?: FormData;
}

interface FormData {
  text: KeyValue[];
  file: FormDataFileEntry[];
}

export interface KeyValue {
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

interface Auth {
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
}
