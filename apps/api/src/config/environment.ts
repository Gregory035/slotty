import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional(),
);

const optionalVatCode = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.coerce.number().int().min(1).max(6).optional(),
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
  RATE_LIMIT_PASSWORD_RESET_MAX: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  RATE_LIMIT_WEB_VITALS_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_WEB_VITALS_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  BOT_TOKEN_ENCRYPTION_KEY: z.string().min(32),
  YOOKASSA_SHOP_ID: optionalString,
  YOOKASSA_SECRET_KEY: optionalString,
  YOOKASSA_VAT_CODE: optionalVatCode,
  PAYMENT_RETURN_URL: optionalUrl,
  METRICS_TOKEN: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
  ERROR_TRACKING_URL: optionalUrl,
  SENTRY_DSN: optionalUrl,
  SENTRY_ENVIRONMENT: optionalString,
  SENTRY_RELEASE: optionalString,
  WORK_EXAMPLES_DIR: z.string().min(1).default('./data/work-examples'),
  WORK_EXAMPLES_STORAGE: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  RESEND_API_KEY: optionalString,
  PASSWORD_RESET_FROM_EMAIL: optionalString,
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  COMPANY_INVITATION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  RATE_LIMIT_INVITATION_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_INVITATION_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_INVITATION_REGISTER_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_INVITATION_REGISTER_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  RATE_LIMIT_INVITATION_ACCEPT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_INVITATION_ACCEPT_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  WEB_PUSH_PUBLIC_KEY: optionalString,
  WEB_PUSH_PRIVATE_KEY: optionalString,
  WEB_PUSH_SUBJECT: optionalString,
  BACKUP_STATUS_FILE: z.string().min(1).default('/backups/latest-status.json'),
  BACKUP_REMOTE_CONFIGURED: z.enum(['true', 'false']).default('false'),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }

  if (result.data.WORK_EXAMPLES_STORAGE === 's3') {
    const required = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;
    const missing = required.filter((key) => !result.data[key]);
    if (missing.length) {
      throw new Error(`Invalid environment configuration: ${missing.join(', ')} required for S3 storage`);
    }
  }

  const pushValues = [result.data.WEB_PUSH_PUBLIC_KEY, result.data.WEB_PUSH_PRIVATE_KEY, result.data.WEB_PUSH_SUBJECT];
  if (pushValues.some(Boolean) && !pushValues.every(Boolean)) {
    throw new Error('Invalid environment configuration: WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY and WEB_PUSH_SUBJECT must be configured together');
  }

  return result.data;
}
