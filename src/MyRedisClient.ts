import { Redis } from "ioredis";
import debug from 'debug';

const APP_NAME = 'indigo-milestones';

const log = debug(`${APP_NAME}:redis-client`);

const DELETED = '__DELETED__';

const logError = (err: unknown) => log(err);

export class MyRedisClient {
  url: string;
  client: Redis;
  isConnected: boolean;

  constructor(url: string) {
    const client = new Redis(url).on('error', logError);

    this.url = url;
    this.client = client;
    this.isConnected = false;
  }

  async connect() {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;

      log(`[${APP_NAME}:my-little-redis] Redis connected`);
    }
  }

  async get(key: string) {
    await this.connect();

    const data = await this.client.get(key);

    try {
      return JSON.parse(data as string);
    } catch {
      return null;
    }
  }

  async set(key: string, value: any) {
    await this.connect();

    return this.client.set(key, JSON.stringify(value));
  }

  async del(key: string) {
    await this.connect();

    return this.client.del(key);
  }

  async incr(key: string) {
    await this.connect();

    return this.client.incr(key);
  }

  async expire(key: string, seconds: number) {
    await this.connect();

    return this.client.expire(key, seconds);
  }

  async rateLimit(key: string, limit: number, seconds: number): Promise<boolean> {
    await this.connect();

    const res = await this.client.incr(key);

    if (res === 1) {
      await this.client.expire(key, seconds);
    }

    return res >= limit;
  }

  async fetch(key: string, query: () => Promise<any>, time: number = 0) {
    const result = await this.get(key);

    if (result === DELETED) {
      return null;
    }

    if (!result && query) {
      return query().then(async data => {
        if (data) {
          await this.store(key, data, time);
        }

        return data;
      });
    }

    return result;
  }

  async store(key: string, data: any, time: number = 0) {
    const result = this.set(key, data);

    if (time > 0) {
      await this.expire(key, time);
    }

    return result;
  }

  async remove(key: string, soft = false) {
    return soft ? this.set(key, DELETED) : this.del(key);
  }

  async subscribe(channel: string, listener: (message: string) => void) {
    try {
      // Ensure the client is connected before subscribing
      if (!this.isConnected) {
        await this.connect();
      }

      // Subscribe to the channel
      await this.client.subscribe(channel);

      // Register the listener for the subscribed channel
      this.client.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          listener(message);
        }
      });

      log(`[${APP_NAME}:my-little-redis] Subscribed to channel: ${channel}`);
    } catch (error) {
      logError(error);
    }
  }

  /**
   * Wrapper for the `on` method of the Redis client.
   * Adds a listener for a specific event on the Redis client.
   *
   * @param event - The name of the event to listen for.
   * @param listener - The callback function to invoke when the event occurs.
   */
  on(event: string, listener: (...args: any[]) => void) {
    this.client.on(event, listener);
    log(`[${APP_NAME}:my-little-redis] Listener added for event: ${event}`);
  }

  /**
   * Wrapper for the `publish` method of the Redis client.
   * Publishes a message to a specific channel.
   *
   * @param channel - The name of the channel to publish to.
   * @param message - The message to publish.
   */
  async publish(channel: string, message: string) {
    try {
      // Ensure the client is connected before publishing
      if (!this.isConnected) {
        await this.connect();
      }

      // Publish the message to the specified channel
      await this.client.publish(channel, message);

      log(`[${APP_NAME}:my-little-redis] Published message to channel "${channel}": ${message}`);
    } catch (error) {
      logError(error);
    }
  }
}

export default MyRedisClient;