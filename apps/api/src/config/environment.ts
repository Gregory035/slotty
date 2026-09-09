import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_PUBLIC_URL: optionalUrl,
  WEB_URL: z.string().url().default('http://localhost:5173'),
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_TIMEOUT_MS: z.coerce.number().int().positive().default(1000),
  RATE_LIMIT_FAIL_OPEN: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_REGISTER_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  RATE_LIMIT_REFRESH_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_REFRESH_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WEBHOOK_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WEBHOOK_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AVAILABILITY_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AVAILABILITY_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_CONNECT_BOT_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_CONNECT_BOT_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  BOT_TOKEN_ENCRYPTION_KEY: z.string().min(32),
  YOOKASSA_SHOP_ID: optionalString,
  YOOKASSA_SECRET_KEY: optionalString,
  PAYMENT_RETURN_URL: optionalUrl,
  PAYMENT_WEBHOOK_SECRET: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
  METRICS_TOKEN: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
  ERROR_TRACKING_URL: optionalUrl,
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }

  return result.data;
}
