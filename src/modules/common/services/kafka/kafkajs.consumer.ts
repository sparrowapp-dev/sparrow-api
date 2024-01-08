import { Logger } from "@nestjs/common";
import {
  Admin,
  Consumer,
  ConsumerConfig,
  ConsumerSubscribeTopic,
  Kafka,
  KafkaMessage,
} from "kafkajs";
import * as retry from "async-retry";
import { IConsumer } from "./consumer.interface";

export class KafkajsConsumer implements IConsumer {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private readonly logger: Logger;
  private readonly admin: Admin;

  constructor(
    private readonly topic: ConsumerSubscribeTopic,
    config: ConsumerConfig,
    brokers: string[],
  ) {
    this.kafka = new Kafka({ brokers });
    this.consumer = this.kafka.consumer(config);
    this.logger = new Logger(`${topic.topic}-${config.groupId}`);
    this.admin = this.kafka.admin();
  }

  async consume(onMessage: (message: KafkaMessage) => Promise<void>) {
    try {
      const topics = await this.admin.listTopics();
      const topicToAdd = this.topic.topic as string;
      if (!topics.includes(topicToAdd)) {
        await this.createTopic(topicToAdd);
      }
      await this.consumer.subscribe(this.topic);
      await this.consumer.run({
        eachMessage: async ({ message, partition }) => {
          this.logger.debug(`Processing message partition: ${partition}`);
          try {
            await retry.default(async () => onMessage(message), {
              retries: 3,
              onRetry: (error: any, attempt: number) =>
                this.logger.error(
                  `Error consuming message, executing retry ${attempt}/3...`,
                  error,
                ),
            });
          } catch (err) {
            this.logger.error(
              "Error consuming message. Adding to dead letter queue...",
              err,
            );
          }
        },
      });
    } catch (e) {
      this.logger.error("Error creating topics/consumption", e);
    } finally {
      await this.admin.disconnect();
    }
  }

  async connect() {
    try {
      await this.consumer.connect();
    } catch (err) {
      this.logger.error("Failed to connect to Kafka.", err);
      await this.connect();
    }
  }

  async disconnect() {
    await this.consumer.disconnect();
  }

  async createTopic(topic: string): Promise<void> {
    await this.admin.connect();
    await this.admin.createTopics({
      topics: [{ topic }],
      waitForLeaders: true,
    });
  }
}
