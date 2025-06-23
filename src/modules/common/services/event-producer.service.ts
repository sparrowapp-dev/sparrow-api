import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class ProducerService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async produce(topic: string, message: any) {
    // Emit event with the topic as the event name and message as payload
    // Using emitAsync to support async event handlers
    await this.eventEmitter.emitAsync(topic, message);
  }
}
