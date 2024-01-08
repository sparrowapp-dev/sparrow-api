import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ConsumerConfig,
  ConsumerSubscribeTopic,
  KafkaJSError,
  KafkaMessage,
} from "kafkajs";
import { IConsumer } from "./consumer.interface";
import { KafkajsConsumer } from "./kafkajs.consumer";

interface KafkajsConsumerOptions {
  topic: ConsumerSubscribeTopic;
  config: ConsumerConfig;
  onMessage: (message: KafkaMessage) => Promise<void>;
  onError: (error: KafkaJSError) => Promise<void>;
}

@Injectable()
export class ConsumerService implements OnApplicationShutdown {
  private readonly consumers: IConsumer[] = [];

  constructor(private readonly configService: ConfigService) {}

  async consume({ topic, config, onMessage }: KafkajsConsumerOptions) {
    const kafkaBroker = [this.configService.get("kafka.broker")];
    const consumer = new KafkajsConsumer(topic, config, kafkaBroker);
    await consumer.connect();
    await consumer.consume(onMessage);
    this.consumers.push(consumer);
  }

  async onApplicationShutdown() {
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
  }
}
