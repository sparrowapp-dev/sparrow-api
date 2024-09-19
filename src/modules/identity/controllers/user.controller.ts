import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { UserService } from "../services/user.service";
import { RegisterPayload } from "../payloads/register.payload";
import { UpdateUserDto } from "../payloads/user.payload";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import {
  EarlyAccessPayload,
  ResetPasswordPayload,
  UpdatePasswordPayload,
  VerifyEmailPayload,
} from "../payloads/resetPassword.payload";
import { RefreshTokenGuard } from "@src/modules/common/guards/refresh-token.guard";
import { RefreshTokenRequest } from "./auth.controller";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import { ConfigService } from "@nestjs/config";
import { VerificationPayload } from "../payloads/verification.payload";
import { convertPostmanToMySchema } from "@src/modules/common/util/postman.util";
/**
 * User Controller
 */
@ApiBearerAuth()
@ApiTags("user")
@Controller("api/user")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a User",
    description: "Register and Create a new User",
  })
  @ApiResponse({ status: 201, description: "Registration Completed" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async register(@Body() payload: RegisterPayload, @Res() res: FastifyReply) {
    const data = await this.userService.createUser(payload);
    const responseData = new ApiResponseService(
      "User Created",
      HttpStatusCode.CREATED,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get(":userId")
  @ApiOperation({
    summary: "Retrieve  User",
    description: "This will return  information about a specific user",
  })
  @UseGuards(JwtAuthGuard)
  async getUser(@Param("userId") id: string, @Res() res: FastifyReply) {
    const data = await this.userService.getUserById(id);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get("/postman")
  @ApiOperation({
    summary: "Convert Postman Collection",
    description:
      "This function will change a postman collection to sparrow schema",
  })
  async convertPostmanCollection(@Res() res: FastifyReply) {
    const a = {};
    convertPostmanToMySchema(a);
    return res.status(200).send({});
  }

  @Get("email/:email")
  @ApiOperation({
    summary: "Retrieve User registration process",
    description: "This will return registration status of a specific user",
  })
  async getUserByEmail(
    @Param("email") email: string,
    @Res() res: FastifyReply,
  ) {
    const data = await this.userService.getUserRegisterStatus(
      email.toLowerCase(),
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Put(":userId")
  @ApiOperation({
    summary: "Update a User",
    description: "This will update User Data",
  })
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Param("userId") id: string,
    @Body() updateUserDto: Partial<UpdateUserDto>,
    @Res() res: FastifyReply,
  ) {
    const user = await this.userService.updateUser(id, updateUserDto);
    const responseData = new ApiResponseService(
      "User Updated",
      HttpStatusCode.OK,
      user,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Delete(":userId")
  @ApiOperation({
    summary: "Delete User Account",
    description: "This will delete a User Account",
  })
  @UseGuards(JwtAuthGuard)
  async deleteUser(@Param("userId") id: string, @Res() res: FastifyReply) {
    const data = await this.userService.deleteUser(id);
    const responseData = new ApiResponseService(
      "User Deleted",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @Post("send-verification-email")
  @ApiOperation({
    summary: "Send a Verification Email",
    description:
      "Sending a Verification Email containing a Reset Password Verification Code.",
  })
  async sendVerificationEmail(
    @Body() resetPasswordDto: ResetPasswordPayload,
    @Res() res: FastifyReply,
  ) {
    await this.userService.sendVerificationEmail(resetPasswordDto);
    const responseData = new ApiResponseService(
      "Email Sent Successfully",
      HttpStatusCode.OK,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("send-user-verification-email")
  @ApiOperation({
    summary: "Send a Verification Email",
    description:
      "Sending a Verification Email containing a Verification Code for email verification of user.",
  })
  async sendUserVerificationEmail(
    @Body() verificationPayload: VerificationPayload,
    @Res() res: FastifyReply,
  ) {
    await this.userService.sendUserVerificationEmail(verificationPayload);
    const responseData = new ApiResponseService(
      "Email Sent Successfully",
      HttpStatusCode.OK,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("send-welcome-email")
  @ApiOperation({
    summary: "Send Welcome Email",
    description:
      "Sending a Welcome Email containing welcome to the user who want to get early access",
  })
  async sendWelcomeEmail(
    @Body() earlyAccessDto: EarlyAccessPayload,
    @Res() res: FastifyReply,
  ) {
    await this.userService.sendWelcomeEmail(earlyAccessDto);
    const responseData = new ApiResponseService(
      "Email Sent Successfully",
      HttpStatusCode.OK,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @Get("logout")
  @ApiOperation({
    summary: "Logout User",
    description:
      "This will logout the user and delete RefreshToken(send RefreshToken for logout)",
  })
  @UseGuards(RefreshTokenGuard)
  @ApiResponse({ status: 200, description: "Logout Successfull" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  async logoutUser(
    @Req() request: RefreshTokenRequest,
    @Res() res: FastifyReply,
  ) {
    const userId = request.user._id;
    const refreshToken = request.user.refreshToken;
    await this.userService.logoutUser(userId, refreshToken);
    const responseData = new ApiResponseService(
      "User Logout",
      HttpStatusCode.OK,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("verify-email")
  @ApiOperation({
    summary: "Verify Reset Password Verification Code",
    description:
      "Verify the validity of a verification code sent for resetting the password.",
  })
  @ApiResponse({ status: 200, description: "Email Verified" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  async verifyEmail(
    @Res() res: FastifyReply,
    @Body() verifyEmailPayload: VerifyEmailPayload,
  ) {
    const expireTime = this.configService.get(
      "app.emailValidationCodeExpirationTime",
    );
    await this.userService.verifyVerificationCode(
      verifyEmailPayload.email.toLowerCase(),
      verifyEmailPayload.verificationCode,
      expireTime,
    );
    const data = await this.userService.refreshVerificationCode(
      verifyEmailPayload.email.toLowerCase(),
    );
    const responseData = new ApiResponseService(
      "Email Verified Successfully",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("verify-user-email")
  @ApiOperation({
    summary: "Verify Verification Code for email verification of user",
    description:
      "Verify the validity of a verification code sent for email verification of user account.",
  })
  @ApiResponse({ status: 200, description: "Email Verified" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  async verifyUserEmail(
    @Res() res: FastifyReply,
    @Body() verifyEmailPayload: VerifyEmailPayload,
  ) {
    const expireTime = this.configService.get(
      "app.emailValidationCodeExpirationTime",
    );
    const data = await this.userService.verifyUserEmailVerificationCode(
      verifyEmailPayload.email.toLowerCase(),
      verifyEmailPayload.verificationCode,
      expireTime,
    );
    const responseData = new ApiResponseService(
      "Email Verified Successfully",
      HttpStatusCode.OK,
      data,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("change-password")
  @ApiOperation({
    summary: "Update User Password",
    description: "Allows a user to update their password",
  })
  @ApiResponse({ status: 200, description: "Email Verified" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  async updatePassword(
    @Res() res: FastifyReply,
    @Body() updatePasswordPayload: UpdatePasswordPayload,
  ) {
    const expireTime = this.configService.get(
      "app.emailValidationCodeExpirationTime",
    );
    await this.userService.verifyVerificationCode(
      updatePasswordPayload.email.toLowerCase(),
      updatePasswordPayload.verificationCode,
      expireTime,
    );
    await this.userService.updatePassword(
      updatePasswordPayload.email.toLowerCase(),
      updatePasswordPayload.newPassword,
    );
    const responseData = new ApiResponseService(
      "Password Updated",
      HttpStatusCode.OK,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
