import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from "@nestjs/websockets";
import { Server, Socket as SocketServer } from "socket.io";
import { SocketIoService } from "../services/socketio.service";

export const SOCKET_IO_PORT = 9001;

@WebSocketGateway(SOCKET_IO_PORT, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  path: "/socket.io",
  transports: ["websocket"],
})
export class SocketIoGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly socketIoService: SocketIoService) {}

  async afterInit() {
    console.log("Socket.io Handler Gateway initialized!");
  }

  async handleConnection(proxySocketIO: SocketServer) {
    const { targetUrl, namespace, headers } = proxySocketIO.handshake.query;

    if (!targetUrl || !namespace) {
      proxySocketIO.disconnect();
      console.error(
        "Missing required query parameters: url, namespace, or tabid",
      );
      return;
    }

    try {
      const parsedHeaders = JSON.parse(headers as string);
      const headersObject: { [key: string]: string } = parsedHeaders.reduce(
        (
          acc: Record<string, string>,
          { key, value }: { key: string; value: string },
        ) => {
          acc[key] = value;
          return acc;
        },
        {} as { [key: string]: string },
      );

      // Establish a connection to the real Socket.IO server
      const targetSocketIO = await this.socketIoService.connectToTargetSocketIO(
        proxySocketIO,
        targetUrl as string,
        namespace as string,
        headersObject,
      );

      proxySocketIO.on("disconnect", async () => {
        // Disconnecting target Socket.IO will automatically disconnects proxy Socket.IO in chain.
        targetSocketIO?.disconnect();
      });

      // Listen for all dynamic events from the frontend and forward them to target Socket.IO.
      proxySocketIO.onAny(async (event: string, args: any) => {
        try {
          if (event === "sparrow_internal_disconnect") {
            // Disconnecting target Socket.IO will automatically disconnects proxy Socket.IO in chain.
            targetSocketIO?.disconnect();
          } else {
            targetSocketIO?.emit(event, args);
          }
        } catch (err) {
          console.error(`Failed to forward event ${event} for ${err.message}`);
        }
      });
    } catch (err) {
      console.error(
        `Failed to connect to real Socket.IO server for ${err.message}`,
      );
      proxySocketIO.disconnect();
    }
  }
}
