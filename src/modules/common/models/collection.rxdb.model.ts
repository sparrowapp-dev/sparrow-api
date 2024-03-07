import {
  AuthModeEnum,
  BodyModeEnum,
  ItemTypeEnum,
  SourceTypeEnum,
} from "./collection.model";

export enum AddTo {
  Header = "Header",
  QueryParameter = "QueryParameter",
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
  request: {
    selectedRequestBodyType?: BodyModeEnum;
    selectedRequestAuthType?: AuthModeEnum;
    method: string;
    url: string;
    body: {
      raw?: string;
      urlencoded?: KeyValue[];
      formdata?: FormData;
    };
    headers?: KeyValue[];
    queryParams?: KeyValue[];
    auth?: Auth;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

interface FormData {
  text: KeyValue[];
  file: FormDataFileEntry[];
}

interface KeyValue {
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
