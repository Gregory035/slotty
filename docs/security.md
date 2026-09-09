# Безопасность

## Реализовано

- bcrypt-equivalent `scrypt` с уникальной солью для паролей;
- короткий JWT access token, refresh token hash SHA-256 в БД;
- HttpOnly/Secure production cookie, `SameSite=Lax`, path `/api/auth`, 30 дней;
- refresh rotation, reuse detection, revoke current/all sessions;
- exact CORS origin, Origin/Referer check на cookie mutations;
- Helmet/CSP, ограничение JSON 64 KiB и form body 16 KiB;
- Redis rate limits с `429` и `Retry-After`;
- whitelist DTO, запрет неизвестных полей;
- AES-256-GCM для Telegram tokens;
- secret webhook header, idempotent `update_id`;
- Swagger отключён в production по умолчанию;
- маскирование Bearer/Telegram token в error logs;
- dependency audit и Trivy image scan в CI.

Секреты передаются только через environment/secrets GitHub и не входят в images. Ключ шифрования Telegram необходимо ротировать контролируемой re-encryption процедурой: расшифровать текущим ключом, зашифровать новым, затем заменить secret.

Retention: PII клиента анонимизируется endpoint `DELETE .../personal-data`; финансовые snapshots и агрегаты сохраняются. Backup шифруется и хранится согласно локальной политике организации.
