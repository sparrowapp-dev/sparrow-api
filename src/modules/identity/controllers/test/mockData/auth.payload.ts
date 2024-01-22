import { ObjectId } from "mongodb";

export const LoginPayload = {
  email: "test@email.com",
  password: "testpassword",
};

export const LoginResponse = {
  message: "Login Successful",
  httpStatusCode: 200,
  data: {
    accessToken: {
      expires: "2400",
      expiresPrettyPrint: " 40 minutes ",
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NWE1OGZjNjdiYTI5NTMzMTgwMjMyMGYiLCJlbWFpbCI6InVzZXJAZW1haWwuY29tIiwicGVyc29uYWxXb3Jrc3BhY2VzIjpbeyJ3b3Jrc3BhY2VJZCI6IjY1YTU4ZmM2N2JhMjk1MzMxODAyMzIxMiIsIm5hbWUiOiJ1c2VybmFtZSJ9XSwiZXhwIjoxNzA1MzUxODk4LjMyMiwiaWF0IjoxNzA1MzQ5NDk4fQ.ano330i-eesUGDKW-uwBE47xHR0l5WdJhDbBzXDc_rE",
    },
    refreshToken: {
      expires: "604800",
      expiresPrettyPrint: "168 hours,  ",
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NWE1OGZjNjdiYTI5NTMzMTgwMjMyMGYiLCJlbWFpbCI6InVzZXJAZW1haWwuY29tIiwiZXhwIjoxNzA1OTU0Mjk4LjMyNSwiaWF0IjoxNzA1MzQ5NDk4fQ.G8WW0kXfKCwr48_yGGuKLzDfgnG8qWsbfEBMsluE3Ec",
    },
  },
};

export const TokenResponse = {
  expires: "2400",
  expiresPrettyPrint: " 40 minutes ",
  token:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NWE1OGZjNjdiYTI5NTMzMTgwMjMyMGYiLCJlbWFpbCI6InVzZXJAZW1haWwuY29tIiwicGVyc29uYWxXb3Jrc3BhY2VzIjpbeyJ3b3Jrc3BhY2VJZCI6IjY1YTU4ZmM2N2JhMjk1MzMxODAyMzIxMiIsIm5hbWUiOiJ1c2VybmFtZSJ9XSwiZXhwIjoxNzA1MzUyMzE3Ljc1OCwiaWF0IjoxNzA1MzQ5OTE3fQ.aHS_oJSgXoU4sMvnOtIjqdKMdvCILxqn8pR3wVUw2J0",
};

export const RefreshTokenRequest = {
  user: {
    _id: "",
    refreshToken: "",
  },
};

export const RefreshTokenResponse = {
  message: "Token Generated",
  httpStatusCode: 200,
  data: {
    newAccessToken: TokenResponse,
    newRefreshToken: TokenResponse,
  },
};

export const OauthUserDetails = {
  user: {
    oAuthId: "",
    name: "",
    email: "",
  },
};

export const UserDetails = {
  _id: new ObjectId("mockedUserId"),
  name: "test",
  email: "test@email.com",
  teams: [] as any,
  personalWorkspaces: [] as any,
};

export const MockUrl = "https://mock.com";
