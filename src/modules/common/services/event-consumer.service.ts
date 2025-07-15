import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

interface EventEmitterConsumerOptions {
  topic: { topic: string };
  onMessage: (message: any) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

@Injectable()
export class ConsumerService implements OnApplicationShutdown {
  private readonly listeners: Array<{
    topic: { topic: string };
    callback: (message: any) => Promise<void>;
  }> = [];

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async consume({ topic, onMessage, onError }: EventEmitterConsumerOptions) {
    // Wrap the callback to handle errors if onError is provided
    const wrappedCallback = async (message: any) => {
      try {
        await onMessage(message);
      } catch (error) {
        if (onError) {
          await onError(error);
        }
      }
    };

    // Register the listener
    this.eventEmitter.on(topic.topic, wrappedCallback);

    // Store reference for cleanup
    this.listeners.push({ topic, callback: wrappedCallback });
  }

  async onApplicationShutdown() {
    // Remove all registered listeners
    for (const { topic, callback } of this.listeners) {
      this.eventEmitter.off(topic.topic, callback);
    }
    this.listeners.length = 0; // Clear the array
  }
}
