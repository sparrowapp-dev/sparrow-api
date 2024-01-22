import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "../auth.controller";
import { AuthService } from "../../services/auth.service";
import {
  LoginPayload,
  LoginResponse,
  OauthUserDetails,
  RefreshTokenRequest,
  RefreshTokenResponse,
  TokenResponse,
  UserDetails,
  MockUrl,
} from "./mockData/auth.payload";
import { FastifyReply } from "fastify";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { ContextService } from "@src/modules/common/services/context.service";
import { UserService } from "../../services/user.service";
import { ConfigService } from "@nestjs/config";

export const createFastifyReplyMock = (): FastifyReply => {
  const mock: FastifyReply = {
    raw: {} as any,
    context: {} as any,
    log: {} as any,
    request: {} as any,
    server: {} as any,
    code: jest.fn(),
    status: jest.fn(),
    statusCode: HttpStatusCode.OK,
    sent: false,
    send: jest.fn(),
    header: jest.fn(),
    getHeader: jest.fn(),
    getHeaders: jest.fn(),
    removeHeader: jest.fn(),
    redirect: jest.fn(),
    removeTrailer: jest.fn(),
    then: jest.fn(),
    trailer: jest.fn(),
    type: jest.fn(),
    serialize: jest.fn(),
    serializeInput: jest.fn(),
    serializer: jest.fn(),
    getResponseTime: jest.fn(),
    getSerializationFunction: jest.fn(),
    hasHeader: jest.fn(),
    hasTrailer: jest.fn(),
    headers: jest.fn(),
    helmet: jest.fn(),
    hijack: jest.fn(),
    callNotFound: jest.fn(),
    compileSerializationSchema: jest.fn(),
    cspNonce: {
      script: "",
      style: "",
    },
  };
  return mock;
};

describe("AuthController", () => {
  let controller: AuthController;
  let mockFastifyReply: FastifyReply;
  const authServiceMock = {
    validateUser: jest.fn().mockResolvedValue(UserDetails),
    checkRefreshTokenSize: jest.fn().mockResolvedValue(null),
    createToken: jest.fn().mockResolvedValue(TokenResponse),
    createRefreshToken: jest.fn().mockResolvedValue(TokenResponse),
    validateRefreshToken: jest.fn().mockResolvedValue(TokenResponse),
  };
  const configServiceMock = {
    get: jest.fn().mockReturnValue("testget"),
  };
  const contextServiceMock = {
    set: jest.fn(),
  };
  const userServiceMock = {
    getUserByEmail: jest.fn().mockResolvedValue({ _id: "" }),
    createGoogleAuthUser: jest.fn().mockResolvedValue({ insertedId: "" }),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService, ContextService, UserService, ConfigService],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(ContextService)
      .useValue(contextServiceMock)
      .overrideProvider(UserService)
      .useValue(userServiceMock)
      .overrideProvider(ConfigService)
      .useValue(configServiceMock)
      .compile();

    controller = module.get<AuthController>(AuthController);
    mockFastifyReply = createFastifyReplyMock();
  });

  describe("auth", () => {
    it("should return a valid response on successful login", async () => {
      //Mock/Remock anything required for this particular test case
      mockFastifyReply.status = jest.fn().mockReturnValue({
        send: jest.fn().mockReturnValue(LoginResponse),
      });

      //Call function that you want to test
      const result = await controller.login(LoginPayload, mockFastifyReply);

      // Write Assertions
      expect(result).toEqual(LoginResponse);
    });

    it("should return a valid refresh token", async () => {
      mockFastifyReply.status = jest.fn().mockReturnValue({
        send: jest.fn().mockReturnValue(RefreshTokenResponse),
      });

      const result = await controller.refreshToken(
        RefreshTokenRequest,
        mockFastifyReply,
      );

      expect(result).toEqual(RefreshTokenResponse);
    });

    it("should initiate google oauth callback with user details", async () => {
      mockFastifyReply.redirect = jest.fn().mockReturnValue("redirect");
      configServiceMock.get = jest.fn().mockReturnValue(MockUrl);
      await controller.googleCallback(OauthUserDetails, mockFastifyReply);

      expect(mockFastifyReply.redirect).toBeCalledWith(
        HttpStatusCode.MOVED_PERMANENTLY,
        `${MockUrl}?accessToken=${TokenResponse.token}&refreshToken=${TokenResponse.token}`,
      );
    });

    it("should create oauth user in case user dosent exists", async () => {
      userServiceMock.getUserByEmail = jest.fn().mockResolvedValue(null);
      mockFastifyReply.redirect = jest.fn().mockReturnValue("redirect");
      configServiceMock.get = jest.fn().mockReturnValue(MockUrl);
      await controller.googleCallback(OauthUserDetails, mockFastifyReply);

      expect(userServiceMock.createGoogleAuthUser).toBeCalled();
      expect(mockFastifyReply.redirect).toBeCalledWith(
        HttpStatusCode.MOVED_PERMANENTLY,
        `${MockUrl}?accessToken=${TokenResponse.token}&refreshToken=${TokenResponse.token}`,
      );
    });
  });
});
