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
    defaultTeamNameSuffix: "'s Hub",
    imageSizeLimit: 2097152, // value in byte
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
    smtpEnabled: process.env.SMTP_ENABLED || "false",
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
      enableGoogleAuth: process.env.ENABLE_GOOGLE_AUTH,
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
    sparrowWebsite: "https://sparrowapp.dev",
    sparrowWebsiteName: "www.sparrowapp.dev",
  },
  auth: {
    baseURL: process.env.AUTH_BASE_URL,
  },
  marketing: {
    baseURL: process.env.MARKETING_BASE_URL,
  },
  social: {
    linkedinUrl: "https://www.linkedin.com/showcase/sparrow-app/",
    githubUrl: "https://github.com/sparrowapp-dev/sparrow-app",
    discordUrl: "https://discord.com/invite/thQhnvM42A",
  },
  azure: {
    connectionString: process.env.AZURE_CONNECTION_STRING,
    insightsConnectionString: process.env.AZURE_INSIGHTS_CONNECTION_STRING,
  },
  feedbackBlob: {
    container: process.env.FEEDBACK_BLOB_CONTAINER,
  },
  ai: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    maxTokens: parseInt(process.env.AZURE_OPENAI_MAX_TOKENS),
    monthlyTokenLimit: parseInt(process.env.AZURE_OPENAI_MONTHLY_TOKEN_LIMIT),
    assistantId: process.env.AZURE_OPENAI_ASSISTANT_ID,
    deepseekEndpoint: process.env.DEEPSEEK_ENDPOINT,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    deepseekApiVersion: process.env.DEEPSEEK_API_VERSION,
    deepseekURL: "https://api.deepseek.com"
  },
  hubspot: {
    hubspotEnabled: process.env.HUBSPOT_INTEGRATION_ENABLED,
    formId: process.env.HUBSPOT_FORMID,
    portalId: process.env.HUBSPOT_PORTALID,
    baseURL: process.env.HUBSPOT_BASEURL,
  },
  docs: {
    beehiivApiKey: process.env.BEEHIIV_API_KEY,
    beehiivPublicationId: process.env.BEEHIIV_PUBLICATION_ID,
  },
  testing: {
    whitelistEmail: process.env.WHITELIST_EMAIL_LIST,
  },
  whitelist: {
    userEmails: process.env.WHITELIST_USER_EMAILS,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN_KEY,
    environment: process.env.SENTRY_APP_ENVIRONMENT,
  },
});
