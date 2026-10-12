export interface AdaptivePollingOptions {
  activeDelayMs: number;
  idleDelaysMs: readonly number[];
  onError: (error: unknown) => void;
}

export class AdaptivePollingLoop {
  private timer?: NodeJS.Timeout;
  private idleIndex = 0;
  private active = false;

  constructor(
    private readonly poll: () => Promise<number>,
    private readonly options: AdaptivePollingOptions,
  ) {
    if (options.activeDelayMs < 0 || options.idleDelaysMs.length === 0) {
      throw new Error('Adaptive polling delays must be configured');
    }
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.schedule(0);
  }

  stop(): void {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(delayMs: number): void {
    if (!this.active) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.run();
    }, delayMs);
    this.timer.unref();
  }

  private async run(): Promise<void> {
    if (!this.active) return;
    let processed = 0;
    try {
      processed = await this.poll();
    } catch (error) {
      this.options.onError(error);
    }
    if (!this.active) return;
    if (processed > 0) {
      this.idleIndex = 0;
      this.schedule(this.options.activeDelayMs);
      return;
    }
    const delay = this.options.idleDelaysMs[Math.min(this.idleIndex, this.options.idleDelaysMs.length - 1)]!;
    this.idleIndex = Math.min(this.idleIndex + 1, this.options.idleDelaysMs.length - 1);
    this.schedule(delay);
  }
}
