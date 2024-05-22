export enum ErrorMessages {
  ExpiredToken = "Token has expired",
  Unauthorized = "Unauthorized Access",
  SystemUnauthorized = "UnauthorizedException",
  TokenExpiredError = "TokenExpiredError",
  VerificationCodeExpired = "Verification Code Expired",
  BadRequestError = "Bad Request",
  PasswordExist = "Old Password and New Password cannot be same",
  InvalidFile = "Invalid File Type",
}

export enum FeedbackErrorMessages {
  VideoCountLimit = "Only one video per feedback is allowed",
  VideoSizeLimit = "Video size should be less than 20 MB",
  FilesCountLimit = "Files Count should not be greater than 5",
  ImageSizeLimit = "Image and Pdf size should be less than 2 MB",
}
