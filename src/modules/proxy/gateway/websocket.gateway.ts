import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { WebSocketServer as WsServer, WebSocket } from "ws";
import * as url from "url";
import {
  WebsocketEvent,
  WebSocketService,
} from "../services/websocket.service";

// Extend WebSocket to include custom properties
interface CustomWebSocket extends WebSocket {
  query?: Record<string, any>;
}

// @WSGateway({ path: "/ws", cors: true })
export class WebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: WsServer;

  constructor(private readonly websocketService: WebSocketService) {}

  /**
   * Lifecycle hook that runs when the WebSocket gateway is initialized.
   */
  async afterInit() {
    console.log("WebSocket Gateway initialized!");
  }

  /**
   * Handle WebSocket connection from the frontend client.
   */
  async handleConnection(client: CustomWebSocket, req: Request) {
    // Parse the URL from the upgrade request and attach it to the client
    const headers = req.headers;
    const parsedUrl = url.parse(req.url || "", true);
    client["query"] = parsedUrl.query;

    const tabid = client["query"].tabid as string;
    const targetUrl = client["query"].targetUrl as string;

    if (!tabid || !targetUrl) {
      console.error("Missing tabid or targetUrl in WebSocket URL.");
      client.close(4000, "TabID and TargetURL are required");
      return;
    }

    console.log(
      `Received WebSocket connection: TabID=${tabid}, TargetURL=${targetUrl}`,
    );

    // Establish the connection
    const success = await this.websocketService.establishConnection(
      client,
      tabid,
      targetUrl,
      headers,
    );

    if (!success) {
      console.error(
        `Failed to connect to real WebSocket server for TabID=${tabid}`,
      );
      client.close(4001, "Failed to connect to real WebSocket server");
    }

    this.websocketService.sendEventToFrontendClient(
      tabid,
      WebsocketEvent.connect,
    );

    client.on("message", (data) => {
      console.log("Frontend WebSocket client message received.");
      console.log(data);
    });

    client.on("error", (error) => {
      console.error("Frontend WebSocket error:", error.message);
      this.websocketService.cleanupConnectionsByClient(client);
    });
  }

  /**
   * Handle WebSocket disconnection from the frontend client.
   */
  async handleDisconnect(client: WebSocket) {
    console.log("Frontend WebSocket client disconnected.");
    this.websocketService.cleanupConnectionsByClient(client);
  }
}
