import { Injectable } from "@nestjs/common";

@Injectable()
export class ContextService {
  private contextData: Record<string, any> = {};

  set(key: string, value: any) {
    this.contextData[key] = value;
  }

  get(key: string) {
    return this.contextData[key];
  }
}
