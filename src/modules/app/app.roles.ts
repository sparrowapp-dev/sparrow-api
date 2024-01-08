import { RolesBuilder } from "nest-access-control";

export enum AppRoles {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

/**
 * Roles Builder
 */
export const roles: RolesBuilder = new RolesBuilder();

// The default app role doesn't have readAny(users) because the user returned provides a password.
// To mutate the return body of mongo queries try editing the userService
roles
  .grant(AppRoles.ADMIN)
  .readOwn("user")
  .updateOwn("user")
  .deleteOwn("user")
  .grant(AppRoles.ADMIN)
  .readAny("user")
  .updateAny("user")
  .deleteAny("user");
