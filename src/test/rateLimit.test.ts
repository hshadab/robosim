import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkRateLimit,
  recordRequest,
  clearRateLimit,
  getRateLimitStatus,
  withRateLimit,
  RATE_LIMIT_CONFIGS,
} from '../lib/rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    clearRateLimit();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const result = checkRateLimit('test');
      expect(result.allowed).toBe(true);
      expect(result.waitMs).toBe(0);
    });

    it('should block requests when limit exceeded', () => {
      const config = { maxRequests: 2, windowMs: 1000 };

      // Record 2 requests
      recordRequest('test');
      recordRequest('test');

      const result = checkRateLimit('test', config);
      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
    });

    it('should allow requests after window expires', () => {
      const config = { maxRequests: 1, windowMs: 1000 };

      recordRequest('test');

      // Advance time past the window
      vi.advanceTimersByTime(1001);

      const result = checkRateLimit('test', config);
      expect(result.allowed).toBe(true);
    });

    it('should enforce minimum delay between requests', () => {
      const config = { maxRequests: 10, windowMs: 10000, minDelayMs: 500 };

      recordRequest('test');
      vi.advanceTimersByTime(100); // Only 100ms passed

      const result = checkRateLimit('test', config);
      expect(result.allowed).toBe(false);
      expect(result.waitMs).toBe(400); // Need to wait 400ms more
    });

    it('should track remaining requests correctly', () => {
      const config = { maxRequests: 5, windowMs: 1000 };

      recordRequest('test');
      recordRequest('test');

      const result = checkRateLimit('test', config);
      expect(result.remainingRequests).toBe(3);
    });
  });

  describe('recordRequest', () => {
    it('should record requests for tracking', () => {
      recordRequest('test');
      recordRequest('test');

      const status = getRateLimitStatus('test');
      expect(status?.requestsInWindow).toBe(2);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return null for unknown keys', () => {
      const status = getRateLimitStatus('unknown');
      expect(status).toBeNull();
    });

    it('should return correct status after requests', () => {
      const config = RATE_LIMIT_CONFIGS.default;

      recordRequest('test');
      recordRequest('test');
      recordRequest('test');

      const status = getRateLimitStatus('test');
      expect(status?.requestsInWindow).toBe(3);
      expect(status?.remainingRequests).toBe(config.maxRequests - 3);
    });
  });

  describe('withRateLimit', () => {
    it('should execute function when rate limit allows', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const limitedFn = withRateLimit('test', mockFn);

      const result = await limitedFn();

      expect(mockFn).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should wait when rate limited', async () => {
      const config = { maxRequests: 1, windowMs: 1000 };
      const mockFn = vi.fn().mockResolvedValue('success');
      const limitedFn = withRateLimit('waitTest', mockFn, config);

      // First call should succeed immediately
      await limitedFn();

      // Second call should wait
      const promise = limitedFn();

      // Advance time
      vi.advanceTimersByTime(1001);

      const result = await promise;
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearRateLimit', () => {
    it('should clear specific key', () => {
      recordRequest('key1');
      recordRequest('key2');

      clearRateLimit('key1');

      expect(getRateLimitStatus('key1')).toBeNull();
      expect(getRateLimitStatus('key2')).not.toBeNull();
    });

    it('should clear all keys when no key specified', () => {
      recordRequest('key1');
      recordRequest('key2');

      clearRateLimit();

      expect(getRateLimitStatus('key1')).toBeNull();
      expect(getRateLimitStatus('key2')).toBeNull();
    });
  });

  describe('RATE_LIMIT_CONFIGS', () => {
    it('should have default configs for known APIs', () => {
      expect(RATE_LIMIT_CONFIGS.claude).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.huggingface).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.fal).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.default).toBeDefined();
    });

    it('should have reasonable limits', () => {
      expect(RATE_LIMIT_CONFIGS.claude.maxRequests).toBeGreaterThan(0);
      expect(RATE_LIMIT_CONFIGS.claude.windowMs).toBeGreaterThan(0);
    });
  });
});
