import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, WebSocket } from "ws";
import { AiAssistantService } from "../services/ai-assistant.service";

/**
 * WebSocket Gateway for AI Assistant.
 * Handles WebSocket connections, disconnections, and incoming messages
 * for the AI Assistant service.
 */

@WebSocketGateway({ path: "/ai-assistant" , cors: true})
export class AiAssistantGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {

  @WebSocketServer()
  private server: Server;

  constructor(private readonly aiAssistantService: AiAssistantService) {}

  afterInit(server: Server) {
    console.log("WebSocket server initialized");
  }

  async handleConnection(client: WebSocket) {
    console.log("Client connected");
  
    client.on("close", () => {
      console.log("Client disconnected");
    });
  
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event: "connected", message: "Welcome to AI Assistant!" }));
      this.aiAssistantService.generateTextChatBot(client);
    }
  }

  async handleDisconnect(client: WebSocket) {
    console.log("Client disconnected");
  }
}

// @WebSocketGateway({ path: "/dummy" })
// export class DummyGateway
//   implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
// {
//   @WebSocketServer()
//   server: Server;

//   constructor() {}
//   async afterInit() {
//     console.log("AI Websocket Gateway initialized!");
//   }

//   async handleConnection(client: Socket) {
//     setTimeout(() => {
//       client.emit("Client", "Client is connected, first event initiated.");
//     }, 5000);
//   }

//   handleDisconnect(client: Socket) {
//     console.log(`Client disconnected: ${client.id}`);
//   }

//   @SubscribeMessage("")
//   async handleMessage2(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() payload: string,
//   ) {
//     client.emit("third", payload);
//   }

//   @SubscribeMessage("second")
//   async handleMessage3(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() payload: string,
//   ) {
//     client.emit("second", payload);
//     client.emit("latest", payload);
//   }

//   @SubscribeMessage("first")
//   async handleMessage(
//     @ConnectedSocket() client: Socket,
//     @MessageBody() payload: string,
//   ) {
//     client.emit("first", payload);
//     client.emit("new", payload);
//   }
// }