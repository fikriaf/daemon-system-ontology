import type Redis from 'ioredis';

export class EventPublisher {
  constructor(private redis: Redis) {}

  async publish(eventName: string, payload: unknown): Promise<void> {
    const channel = `events:${eventName}`;
    await this.redis.publish(channel, JSON.stringify(payload));
  }
}
