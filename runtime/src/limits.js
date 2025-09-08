export class Semaphore {
  constructor(max = 1) {
    this.max = Math.max(1, max);
    this.current = 0;
    this.queue = [];
  }
  acquire() {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (this.current < this.max) {
          this.current++;
          resolve(() => this.release());
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }
  release() {
    this.current = Math.max(0, this.current - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

export class TokenBucket {
  constructor(ratePerSec = 0, burst = 0) {
    this.rate = Math.max(0, ratePerSec);
    this.capacity = Math.max(burst || this.rate, this.rate);
    this.tokens = this.capacity;
    this.last = Date.now();
  }
  allow() {
    if (this.rate <= 0) return true;
    const now = Date.now();
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.rate);
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

