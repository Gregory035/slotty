import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { AdaptivePollingLoop } from '../common/adaptive-polling-loop';
import { BillingService } from './billing.service';

@Injectable()
export class BillingRenewalWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BillingRenewalWorker.name);
  private readonly polling: AdaptivePollingLoop;

  constructor(private readonly billing: BillingService) {
    this.polling = new AdaptivePollingLoop(() => this.billing.processRenewals(), {
      activeDelayMs: 5_000,
      idleDelaysMs: [5 * 60_000, 15 * 60_000, 60 * 60_000],
      onError: (error) => this.logger.error('Subscription renewal failed', error),
    });
  }

  onApplicationBootstrap(): void {
    this.polling.start();
  }

  onApplicationShutdown(): void {
    this.polling.stop();
  }
}
