const Redis = require("ioredis");

/**
 * Redis Configuration
 * Used for distributed locking, caching, and session management
 */

let redis = null;

const connectRedis = () => {
  if (redis) return redis;

  const config = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    username: "default",
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,

    // 🔥 Upstash yêu cầu TLS
    tls: process.env.REDIS_HOST !== "localhost" ? {} : undefined,

    retryStrategy: (times) => {
      if (times > 5) {
        console.error("Redis: Max retry attempts reached");
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000);
    },

    maxRetriesPerRequest: 3,
  };

  redis = new Redis(config);

  redis.on("connect", () => {
    console.log("✓ Redis connected");
  });

  redis.on("ready", () => {
    console.log("✓ Redis ready");
  });

  redis.on("error", (err) => {
    console.error("Redis error:", err.message);
  });

  redis.on("close", () => {
    console.log("Redis connection closed");
  });

  return redis;
};

const getRedis = () => {
  if (!redis) {
    return connectRedis();
  }
  return redis;
};

const disconnectRedis = async () => {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log("Redis disconnected");
  }
};

// Health check
const pingRedis = async () => {
  try {
    const client = getRedis();
    const result = await client.ping();
    return result === "PONG";
  } catch (error) {
    return false;
  }
};

module.exports = {
  connectRedis,
  getRedis,
  disconnectRedis,
  pingRedis,
};