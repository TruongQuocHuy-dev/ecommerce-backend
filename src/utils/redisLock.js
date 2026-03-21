const { getRedis } = require('../configs/config.redis');
const crypto = require('crypto');

/**
 * Redis Distributed Lock
 * Prevents race conditions during inventory operations
 * Uses SET NX (only if not exists) with expiry for atomic lock acquisition
 */

class RedisLock {
  /**
   * Acquire lock for inventory reservation
   * @param {String} resourceId - SKU or product ID to lock
   * @param {Number} ttl - Lock timeout in ms (default 10s)
   * @returns {String|null} Lock token if acquired, null if failed
   */
  static async acquire(resourceId, ttl = 10000) {
    try {
      const redis = getRedis();
      const lockKey = `lock:inventory:${resourceId}`;
      const token = crypto.randomBytes(16).toString('hex');
      
      // SET NX (only if not exists) with expiry
      // Returns 'OK' if lock acquired, null otherwise
      const result = await redis.set(lockKey, token, 'PX', ttl, 'NX');
      
      return result === 'OK' ? token : null;
    } catch (error) {
      console.error('RedisLock acquire error:', error.message);
      return null;
    }
  }

  /**
   * Release lock using Lua script for atomic check-and-delete
   * Only releases if token matches (prevents releasing someone else's lock)
   * @param {String} resourceId - SKU or product ID
   * @param {String} token - Lock token from acquire
   * @returns {Boolean} True if released successfully
   */
  static async release(resourceId, token) {
    try {
      const redis = getRedis();
      const lockKey = `lock:inventory:${resourceId}`;
      
      // Lua script for atomic check-and-delete
      // Only deletes if the value matches our token
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await redis.eval(script, 1, lockKey, token);
      return result === 1;
    } catch (error) {
      console.error('RedisLock release error:', error.message);
      return false;
    }
  }

  /**
   * Execute function with lock (auto-acquire and release)
   * Implements retry logic for contention scenarios
   * @param {String} resourceId - Resource to lock
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Lock options
   */
  static async withLock(resourceId, fn, options = {}) {
    const { ttl = 10000, retries = 3, retryDelay = 100 } = options;
    
    let attempts = 0;
    let lastError = null;
    
    while (attempts < retries) {
      const token = await this.acquire(resourceId, ttl);
      
      if (token) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          throw error;
        } finally {
          await this.release(resourceId, token);
        }
      }
      
      attempts++;
      if (attempts < retries) {
        await new Promise(r => setTimeout(r, retryDelay * attempts));
      }
    }
    
    throw new Error('Could not acquire lock. Resource is busy. Please try again.');
  }

  /**
   * Acquire multiple locks atomically
   * If any lock fails, release all acquired locks
   * @param {Array} resourceIds - Array of resource IDs to lock
   * @param {Number} ttl - Lock timeout
   * @returns {Array} Array of lock objects [{id, token}] or null if failed
   */
  static async acquireMultiple(resourceIds, ttl = 10000) {
    const locks = [];
    
    for (const resourceId of resourceIds) {
      const token = await this.acquire(resourceId, ttl);
      
      if (!token) {
        // Failed to acquire - release all acquired locks
        for (const lock of locks) {
          await this.release(lock.id, lock.token);
        }
        return null;
      }
      
      locks.push({ id: resourceId, token });
    }
    
    return locks;
  }

  /**
   * Release multiple locks
   * @param {Array} locks - Array of lock objects [{id, token}]
   */
  static async releaseMultiple(locks) {
    for (const lock of locks) {
      await this.release(lock.id, lock.token);
    }
  }
}

module.exports = RedisLock;
