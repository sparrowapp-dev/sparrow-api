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
    deletedAPILimitInDays: 7,
    timeToDaysDivisor: 86400000,
    kafkaHitTimeInterval: 3000,
    refreshTokenSecretKey: process.env.REFRESH_TOKEN_SECRET_KEY,
    emailValidationCodeExpirationTime: parseInt(
      process.env.EMAIL_VALIDATION_CODE_EXPIRY_TIME,
    ),
    refreshTokenExpirationTime: parseInt(
      process.env.REFRESH_TOKEN_EXPIRATION_TIME,
    ),
    refreshTokenMaxLimit: parseInt(process.env.REFRESH_TOKEN_MAX_LIMIT),
    senderEmail: process.env.SMTP_SENDER_EMAIL,
    senderPassword: process.env.SMTP_SENDER_PASSWORD,
    mailHost: process.env.SMTP_MAIL_HOST,
    mailPort: process.env.SMTP_MAIL_PORT,
    mailSecure: process.env.SMTP_MAIL_SECURE,
    userName: process.env.SMTP_USER_NAME,
  },
  db: {
    url: process.env.DB_URL,
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      appUrl: process.env.GOOGLE_APP_URL,
      redirectUrl: process.env.LOGIN_REDIRECT_URL,
      accessType: process.env.GOOGLE_ACCESS_TYPE,
    },
  },
  kafka: {
    broker: process.env.KAFKA_BROKER,
  },
  updater: {
    updateAvailable: process.env.APP_UPDATE_AVAILABLE,
    appVersion: process.env.APP_VERSION,
    windows: {
      appSignature: process.env.WINDOWS_APP_SIGNATURE,
      appUrl: process.env.WINDOWS_APP_URL,
    },
    macAppleSilicon: {
      appSignature: process.env.MAC_APPLE_SILICON_APP_SIGNATURE,
      appUrl: process.env.MAC_APPLE_SILICON_APP_URL,
    },
    macIntel: {
      appSignature: process.env.MAC_INTEL_APP_SIGNATURE,
      appUrl: process.env.MAC_INTEL_APP_URL,
    },
  },
  support: {
    sparrowEmail: process.env.SPARROW_EMAIL,
  },
});
