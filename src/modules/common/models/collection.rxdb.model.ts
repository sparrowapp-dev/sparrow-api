import { AuthModeEnum, BodyModeEnum, ItemTypeEnum } from "./collection.model";

export enum AddTo {
  Header = "Header",
  QueryParameter = "QueryParameter",
}

export interface TransformedRequest {
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
