# Перенос фотографий работ в S3

Slotty умеет хранить новые фотографии локально или в S3-совместимом хранилище. Для production рекомендуется S3: файлы не пропадут при пересоздании контейнера API и не будут раздувать резервную копию PostgreSQL.

## Подготовка

Создайте закрытый bucket и задайте переменные `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Для Selectel, Timeweb Cloud и MinIO при необходимости включите `S3_FORCE_PATH_STYLE=true`.

## Перенос

1. Сделайте резервную копию БД и каталога `WORK_EXAMPLES_DIR`.
2. Запустите проверку без изменений: `npm run migrate:work-images`.
3. Сверьте число найденных и пропущенных файлов.
4. Выполните перенос: `npm run migrate:work-images -- --apply`.
5. Переключите API на `WORK_EXAMPLES_STORAGE=s3` и проверьте полноразмерные изображения и миниатюры.
6. Только после проверки можно удалить локальные копии: `npm run migrate:work-images -- --apply --delete-local`.

Скрипт никогда не удаляет локальные файлы без одновременных флагов `--apply --delete-local`.
