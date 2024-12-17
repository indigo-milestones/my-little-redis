import MyRedisClient from './MyRedisClient';

const REDIS = Symbol();
const isEnabled = !!process.env.REDIS_URL;

export function getClient(url: string = '') {
  return new MyRedisClient(url);
}

const client: MyRedisClient = isEnabled && (global[REDIS] || getClient(process.env.REDIS_URL));

if (!global[REDIS]) {
  global[REDIS] = client;
}

export { MyRedisClient };

export default { isEnabled, client, REDIS };
