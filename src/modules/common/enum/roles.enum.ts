export enum WorkspaceRole {
  ADMIN = "admin",
  EDITOR = "editor",
  VIEWER = "viewer",
}

export enum TeamRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}

export enum Role {
  ADMIN = "admin",
  WRITER = "writer",
  READER = "reader",
}

export enum Permission {
  CreateTeam = "createTeam",
  UpdateTeam = "updateTeam",
  DeleteTeam = "deleteTeam",
  // Define other permissions
}

export enum WorkspaceUserAgentBaseEnum {
  BROWSER_AGENT= "Browser Agent",
  CLOUD_AGENT= "Cloud Agent"
}