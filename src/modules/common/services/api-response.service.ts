import { HttpStatusCode } from "../enum/httpStatusCode.enum";

export class ApiResponseService {
  message: string;
  httpStatusCode: HttpStatusCode;
  data: any;

  constructor(message: string, httpStatusCode: HttpStatusCode, data?: any) {
    this.message = message;
    this.httpStatusCode = httpStatusCode;
    this.data = data ?? {};
  }
}
