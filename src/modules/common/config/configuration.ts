import { Env } from "@common/config/env.validation";

export default () => ({
  app: {
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.APP_ENV || Env.DEV,
    url: process.env.APP_URL,
    jwtSecretKey: process.env.JWT_SECRET_KEY,
    jwtExpirationTime: parseInt(process.env.JWT_EXPIRATION_TIME) || 1800,
    defaultWorkspaceName: "My Workspace",
    userBlacklistPrefix: "BL_",
    defaultTeamNameSuffix: "'s Team",
    imageSizeLimit: 102400,
    refreshTokenSecretKey: process.env.REFRESH_TOKEN_SECRET_KEY,
    emailValidationCodeExpirationTime: parseInt(
      process.env.EMAIL_VALIDATION_CODE_EXPIRY_TIME,
    ),
    refreshTokenExpirationTime: parseInt(
      process.env.REFRESH_TOKEN_EXPIRATION_TIME,
    ),
    refreshTokenMaxLimit: parseInt(process.env.REFRESH_TOKEN_MAX_LIMIT),
    senderEmail: process.env.SENDER_EMAIL,
    senderPassword: process.env.SENDER_PASSWORD,
  },
  db: {
    url: process.env.DB_URL,
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      appUrl: process.env.APP_URL,
      redirectUrl: process.env.LOGIN_REDIRECT_URL,
      accessType: process.env.GOOGLE_ACCESS_TYPE,
    },
  },
  kafka: {
    broker: process.env.KAFKA_BROKER,
  },
});
