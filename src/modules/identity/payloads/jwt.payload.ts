export class JwtPayload {
  iat: number;
  exp: number;
  _id: string;
  role: string;
  isSuperAdmin?: boolean;
}
