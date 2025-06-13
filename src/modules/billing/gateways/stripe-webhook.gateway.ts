import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";

/**
 * Payment event types that can be sent to the frontend
 */
export enum PaymentEventType {
  PAYMENT_SUCCESS = "payment_success",
  PAYMENT_FAILED = "payment_failed",
  PAYMENT_PROCESSING = "payment_processing",
  REFRESH_PAGE = "refresh_page",
  SUBSCRIPTION_UPDATED = "subscription_updated",
  SUBSCRIPTION_CREATED = "subscription_created",
  SUBSCRIPTION_CANCELED = "subscription_canceled",
  SUBSCRIPTION_DELETED = "subscription_deleted",
}

@Injectable()
@WebSocketGateway({
  namespace: "stripe-events",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class StripeWebhookGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger("StripeWebhookGateway");
  private connectedClients: Map<string, Socket> = new Map();

  afterInit(server: Server) {
    this.logger.log("Stripe Webhook Gateway initialized");
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Send a welcome message
    client.emit("connection_established", {
      message: "Connected to Stripe webhook events",
      clientId: client.id,
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage("ping")
  handlePing(client: Socket, payload: any): void {
    this.logger.log(`Received ping from client ${client.id}`);
    client.emit("pong", {
      message: "Pong from server",
      receivedData: payload,
    });
  }

  /**
   * Emits a payment event to all connected clients
   * @param eventType The type of payment event
   * @param data Optional additional data to send
   */
  emitPaymentEvent(eventType: PaymentEventType, data: any = {}) {
    const clientCount = this.connectedClients.size;
    this.logger.log(
      `Emitting payment event: ${eventType} to ${clientCount} clients`,
    );

    if (this.server) {
      this.server.emit(eventType, {
        ...data,
        eventType,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
