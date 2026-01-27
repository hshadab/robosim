/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by tracking error rates and temporarily
 * blocking requests to failing services.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests are immediately rejected
 * - HALF_OPEN: After cooldown, one test request is allowed through
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold?: number;
  /** Time in ms before transitioning from OPEN to HALF_OPEN */
  cooldownMs?: number;
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  cooldownMs: 60000,
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(
    public readonly serviceName: string,
    options?: CircuitBreakerOptions
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  getState(): CircuitState {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.options.cooldownMs) {
        this.state = 'HALF_OPEN';
      }
    }
    return this.state;
  }

  /**
   * Execute an async function through the circuit breaker.
   * @throws CircuitOpenError if the circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitOpenError(this.serviceName, this.options.cooldownMs - (Date.now() - this.lastFailureTime));
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  /** Reset to closed state */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

export class CircuitOpenError extends Error {
  constructor(
    public readonly serviceName: string,
    public readonly remainingMs: number
  ) {
    super(`Circuit breaker open for "${serviceName}". Retry in ${Math.ceil(remainingMs / 1000)}s.`);
    this.name = 'CircuitOpenError';
  }
}

/** Per-service circuit breaker instances */
const breakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(serviceName: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let breaker = breakers.get(serviceName);
  if (!breaker) {
    breaker = new CircuitBreaker(serviceName, options);
    breakers.set(serviceName, breaker);
  }
  return breaker;
}
