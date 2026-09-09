# Tenant isolation

`companyId` обязателен во всех tenant-моделях и service/repository запросах. Пользователь сначала проходит `AccessTokenGuard`, затем `CompanyAccessGuard`; отсутствие явно объявленного permission закрывает доступ.

PostgreSQL содержит составные unique/FK пары `(id, companyId)` для сотрудников, услуг, клиентов, записей, расписаний, уведомлений и платежей. Поэтому связь объекта компании A с объектом компании B отклоняется самой БД.

Правила разработки:

1. Нельзя искать tenant entity только по `id`, если известен `companyId`.
2. Mutation должна использовать compound key или `where: { id, companyId }`.
3. Новый endpoint обязан иметь `@RequirePermissions`.
4. Новый relation обязан сохранять `companyId` в FK.
5. Добавляется regression-тест cross-tenant GET/POST/PATCH/PUT/DELETE.

Integration suite проверяет реальные constraints, конкурентное бронирование и rollback outbox.
