// Test-only upstream: real Express IP resolution and production Redis limiter,
// without loading the application workers or connecting to business data.
require('reflect-metadata');
const express = require('/app/node_modules/express');
const { ConfigService } = require('/app/node_modules/@nestjs/config');
const { configureProxy } = require('/app/apps/api/dist/config/proxy');
const { RedisService } = require('/app/apps/api/dist/rate-limit/redis.service');
const { RateLimitService } = require('/app/apps/api/dist/rate-limit/rate-limit.service');
const { RateLimitGuard } = require('/app/apps/api/dist/rate-limit/rate-limit.guard');
const config = new ConfigService({ REDIS_URL: 'redis://redis:6379', RATE_LIMIT_FAIL_OPEN: false });
const redis = new RedisService(config);
const rule = { name: 'proxy-regression', identity: 'ip', limitEnv: 'TEST_LIMIT', windowEnv: 'TEST_WINDOW', defaultLimit: 2, defaultWindowSeconds: 60 };
const guard = new RateLimitGuard({ getAllAndOverride: () => [rule] }, new RateLimitService(redis, config), config);
const app = express();
configureProxy(app, 2);
app.get('/api/proxy-test', async (req, res) => {
  try {
    await guard.canActivate({
      getHandler: () => undefined, getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    });
    res.json({ ip: req.ip });
  } catch (error) { res.status(error.getStatus?.() || 500).json({ message: error.message }); }
});
app.use((req, res) => { req.resume(); req.on('end', () => res.status(401).json({})); });
app.listen(3000, '0.0.0.0');
