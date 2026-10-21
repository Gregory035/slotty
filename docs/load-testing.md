# Нагрузочная проверка записи

В интеграционных тестах 25 одновременных запросов на один слот должны дать ровно одну запись. Остальные запросы отклоняются ограничением PostgreSQL, поэтому двойная бронь не зависит от одного процесса API.

Для отдельной проверки на staging используется `npm run load:booking`. Нужны переменные:

- `LOAD_TEST_API_URL`;
- `LOAD_TEST_EMAIL` и `LOAD_TEST_PASSWORD`;
- `LOAD_TEST_COMPANY_ID`, `LOAD_TEST_CUSTOMER_ID`, `LOAD_TEST_EMPLOYEE_ID`, `LOAD_TEST_SERVICE_ID`;
- `LOAD_TEST_STARTS_AT` — свободное время минимум через час;
- `LOAD_TEST_CONFIRM=YES`;
- необязательно `LOAD_TEST_CONCURRENCY`, от 2 до 100.

Не запускайте сценарий на production: он создаёт реальную запись. Успешный результат — один HTTP 201, остальные ответы HTTP 409.
