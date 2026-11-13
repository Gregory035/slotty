import { MetricsService } from './metrics.service';

describe('request latency metrics', () => {
  function setup() {
    const count = jest.fn().mockResolvedValue(0);
    return new MetricsService({ company: { count }, appointment: { count }, outboxEvent: { count }, notification: { count }, telegramUpdate: { count }, payment: { count }, webVitalSample: { findMany: jest.fn().mockResolvedValue([]) } } as never);
  }
  it('does not let health probes dilute real request latency', async () => {
    const service = setup();
    service.recordRequest(1, 200, '/api/health/ready');
    service.recordRequest(1, 200, '/api/health/live');
    expect(await service.snapshot()).toEqual(expect.objectContaining({ requests: 0, latencyP95UpperBoundMs: null }));
    service.recordRequest(120, 200, '/api/companies');
    expect(await service.snapshot()).toEqual(expect.objectContaining({ requests: 1, averageLatencyMs: 120, latencyP95UpperBoundMs: 250 }));
  });
  it('reports tail latency rather than only the average', async () => {
    const service = setup();
    for (let index = 0; index < 94; index++) service.recordRequest(2, 200, '/api/companies');
    for (let index = 0; index < 6; index++) service.recordRequest(900, 500, '/api/companies');
    expect(await service.snapshot()).toEqual(expect.objectContaining({ requests: 100, errors: 6, latencyP95UpperBoundMs: 1000, latencyP99UpperBoundMs: 1000 }));
  });
});
