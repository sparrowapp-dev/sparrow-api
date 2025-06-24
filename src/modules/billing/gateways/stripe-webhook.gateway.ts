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
  SUBSCRIPTION_CANCELED_PAYMENT_FAILED = "subscription_canceled_payment_failed",
  SUBSCRIPTION_DELETED_PAYMENT_FAILED = "subscription_deleted_payment_failed",
  INVOICE_VOIDED = "invoice_voided",
  SUBSCRIPTION_SCHEDULE_UPDATED = "subscription_schedule_updated",
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
  // Track which hub each client belongs to
  private clientHubMapping: Map<string, string> = new Map();

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
    this.clientHubMapping.delete(client.id);
  }

  @SubscribeMessage("join-hub")
  handleJoinHub(client: Socket, payload: { hubId: string }): void {
    const { hubId } = payload;

    if (!hubId) {
      this.logger.warn(`Client ${client.id} attempted to join without hubId`);
      client.emit("join-hub-error", { message: "Hub ID is required" });
      return;
    }

    // Leave previous hub room if client was in one
    const previousHubId = this.clientHubMapping.get(client.id);
    if (previousHubId) {
      client.leave(`hub-${previousHubId}`);
      this.logger.log(
        `Client ${client.id} left hub room: hub-${previousHubId}`,
      );
    }

    // Join new hub room
    client.join(`hub-${hubId}`);
    this.clientHubMapping.set(client.id, hubId);

    this.logger.log(`Client ${client.id} joined hub room: hub-${hubId}`);

    // Confirm to client that they've joined the room
    client.emit("hub-joined", { hubId });
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
   * Emits a payment event to clients in a specific hub room
   * @param eventType The type of payment event
   * @param data Event data containing team/hub information
   */
  emitPaymentEvent(eventType: PaymentEventType, data: any = {}) {
    // Extract hubId from the data
    const hubId = data.team?._id?.toString() || data.hubId;

    if (!hubId) {
      this.logger.warn(
        `Cannot emit event ${eventType}: No hubId found in data`,
      );
      return;
    }

    const roomName = `hub-${hubId}`;
    const clientsInRoom =
      this.server.sockets.adapter.rooms.get(roomName)?.size || 0;

    this.logger.log(
      `Emitting payment event: ${eventType} to ${clientsInRoom} clients in room ${roomName}`,
    );

    if (this.server) {
      // Emit only to clients in the specific hub room
      this.server.to(roomName).emit(eventType, {
        ...data,
        eventType,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
