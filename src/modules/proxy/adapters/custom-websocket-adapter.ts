import * as WebSocket from "ws";
import * as SocketIO from "socket.io";
import { WebSocketAdapter } from "@nestjs/common";
import { MessageMappingProperties } from "@nestjs/websockets";
import { Observable, fromEvent, EMPTY, fromEventPattern } from "rxjs";
import { mergeMap, filter } from "rxjs/operators";

type HybridWebsocketServer = WebSocket.Server | SocketIO.Server;
type HybridWebsocketClient = WebSocket.WebSocket | SocketIO.Socket;

export enum SocketServerType {
  SOCKET_IO = "/socket.io",
  WEBSOCKET = "/ws",
  AI_ASSISTANT = "/ai-assistant",
}

export interface SocketServerOptions {
  type: SocketServerType;
  path?: string;
  cors?: {
    origin?: string;
  };
}

export class CustomWebSocketAdapter implements WebSocketAdapter {
  constructor(private app: any) {}

  create(
    port: number,
    options: SocketServerOptions = { type: SocketServerType.WEBSOCKET },
  ): HybridWebsocketServer {
    switch (options.path) {
      case SocketServerType.WEBSOCKET:
      case SocketServerType.AI_ASSISTANT:
        return new WebSocket.Server({
          server: this.app.getHttpServer(),
          ...options,
        });
      case SocketServerType.SOCKET_IO:
        return new SocketIO.Server(port, options);
      default:
        return new SocketIO.Server(port, options);
    }
  }

  bindClientConnect(server: HybridWebsocketServer, callback: any): void {
    const type = this.getSocketServerType(server);

    switch (type) {
      case SocketServerType.WEBSOCKET:
        (server as WebSocket.WebSocketServer).on("connection", callback as any);
        return;
      case SocketServerType.SOCKET_IO:
        (server as SocketIO.Server).on("connection", callback as any);
        return;
    }
  }

  bindMessageHandlers(
    client: HybridWebsocketClient,
    handlers: MessageMappingProperties[],
    process: (data: any) => Observable<any>,
  ) {
    const type = this.getSocketClientType(client);
    switch (type) {
      case SocketServerType.WEBSOCKET:
        const websocketClient = client as WebSocket;
        fromEvent(websocketClient, "message")
          .pipe(
            mergeMap((data) =>
              this.bindMessageHandler(type, data, handlers, process),
            ),
            filter((result) => result),
          )
          .subscribe((response) =>
            websocketClient.send(JSON.stringify(response)),
          );
        break;
      case SocketServerType.SOCKET_IO:
        const socketIOClient = client as SocketIO.Socket;
        const onAny$ = fromEventPattern(
          (handler) => socketIOClient.onAny(handler),
          (handler) => socketIOClient.offAny(handler),
        );

        onAny$
          .pipe(
            mergeMap((data) =>
              this.bindMessageHandler(type, data, handlers, process),
            ),
            filter((result) => result),
          )
          .subscribe(
            ({ response, event }: { response: any; event: string }) => {
              socketIOClient.emit(event, response);
            },
          );
        break;
    }
  }

  bindMessageHandler(
    type: SocketServerType,
    buffer: any,
    handlers: MessageMappingProperties[],
    process: (data: any) => Observable<any>,
  ): Observable<any> {
    switch (type) {
      case SocketServerType.WEBSOCKET:
        // For now, WebSockets will not support the message handler
        return EMPTY;
      case SocketServerType.SOCKET_IO:
        const [event, data] = buffer;

        const body =
          typeof data === "object" && data["body"] !== undefined
            ? data.body
            : data;
        const messageHandler = handlers.find(
          (handler) => handler.message === event,
        );

        if (!messageHandler) {
          return EMPTY;
        }

        const executionPromise = async () => {
          const response = await messageHandler.callback(body);
          return {
            response: response,
            event: event,
          };
        };

        return process(executionPromise());
    }
  }

  close(server: HybridWebsocketServer): void {
    server.close();
  }

  private getSocketClientType(client: HybridWebsocketClient): SocketServerType {
    if (client instanceof WebSocket.WebSocket) {
      return SocketServerType.WEBSOCKET;
    }

    if (client instanceof SocketIO.Socket) {
      return SocketServerType.SOCKET_IO;
    }

    throw new Error("Unknown socket client type!");
  }

  private getSocketServerType(server: HybridWebsocketServer): SocketServerType {
    if (server instanceof WebSocket.Server) {
      return SocketServerType.WEBSOCKET;
    }

    if (server instanceof SocketIO.Server) {
      return SocketServerType.SOCKET_IO;
    }

    throw new Error("Unknown socket server type!");
  }
}
