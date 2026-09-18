# SEO-чек-лист после публикации

## 1. Домен и deployment

- Основной домен: `https://slotty23.ru` без `www` и завершающего `/`, кроме корня.
- На сервере в `/opt/slotty/.env` задать `WEB_URL`, `API_PUBLIC_URL` и `PUBLIC_HOST` для `slotty23.ru`, затем пересобрать web и Caddy.
- Задать `SEO_INDEXING_ENABLED=true` только для production. Для preview/staging оставить `false`.
- Убедиться, что DNS указывает на сервер, Caddy выдаёт валидный сертификат и перенаправляет HTTP на HTTPS.
- При смене домена обновить `WEB_URL`, пересобрать frontend и настроить 301 со старого origin на соответствующие новые URL.

## 2. HTTP-проверка

После публикации выполнить:

```bash
curl -I https://DOMAIN/
curl -I https://DOMAIN/online-zapis
curl -I https://DOMAIN/zapis-cherez-telegram
curl -I https://DOMAIN/app
curl -I https://DOMAIN/ne-sushchestvuet
curl -I https://DOMAIN/online-zapis/
curl https://DOMAIN/robots.txt
curl https://DOMAIN/sitemap.xml
```

Ожидания:

- три публичные страницы — 200, корректный canonical в исходном HTML;
- `/app` — 200 и `X-Robots-Tag: noindex, nofollow`;
- неизвестная страница — 404 и `X-Robots-Tag: noindex, nofollow`;
- URL с завершающим слешем — 308 на canonical-вариант;
- sitemap содержит только три публичных URL и не содержит localhost, ID, параметров или `lastmod`.

## 3. Google Search Console

Панель: [Google Search Console](https://search.google.com/search-console/).

- Создать Domain property и подтвердить владение через DNS.
- Отправить `https://DOMAIN/sitemap.xml`.
- Через URL Inspection проверить `/`, `/online-zapis`, `/zapis-cherez-telegram`.
- Убедиться, что Google выбрал заявленный canonical и видит prerender-текст.
- Проверить, что `/app` и тестовый неизвестный URL не индексируются.
- Еженедельно смотреть Pages, Core Web Vitals, запросы, показы, клики, CTR и конверсии.

Отправка sitemap — сигнал, а не гарантия индексации: [официальная инструкция Google](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## 4. Яндекс Вебмастер

Панель: [Яндекс Вебмастер](https://webmaster.yandex.ru/).

- Добавить HTTPS-сайт и подтвердить права.
- Добавить `https://DOMAIN/sitemap.xml` в «Индексирование → Файлы Sitemap».
- Проверить три публичных URL через «Проверка URL» и мониторинг важных страниц.
- Проверить диагностические сообщения, исключённые страницы, выбранный canonical и обход мобильным роботом.
- Следить за запросами, показами, кликами, CTR и долей брендового/небрендового трафика.

Документация: [Sitemap в Яндекс Вебмастере](https://yandex.ru/support/webmaster/ru/controlling-robot/sitemap).

## 5. Метрика и GA4

Панели: [Яндекс Метрика](https://metrika.yandex.ru/) и [Google Analytics](https://analytics.google.com/).

- Задать существующие `VITE_YM_COUNTER_ID` и `VITE_GA_MEASUREMENT_ID`; не создавать фиктивные ID.
- Проверить, что до согласия и при включённом Do Not Track запросов к счётчикам нет.
- В DebugView/отладчике убедиться, что на SPA-переход приходится один pageview.
- Проверить существующие CTA-события `landing_start_trial`, `landing_view_product`, `landing_login` и новые `registration_start`, `registration_success`.
- `registration_success` должен появляться только после успешного ответа API.
- Убедиться, что события не содержат email, имён, токенов, company ID и URL кабинета.

## 6. Сниппеты и производительность

- Проверить OG-превью абсолютным URL и через отладчики Telegram/соцсетей.
- Проверить JSON-LD валидатором Schema.org и Google Rich Results Test, отдельно оценивая право на rich results.
- Запустить PageSpeed Insights для трёх страниц на mobile и desktop.
- Собирать реальные LCP, INP и CLS; целевые ориентиры на 75-м перцентиле: LCP ≤ 2,5 с, INP ≤ 200 мс, CLS ≤ 0,1.
- Сравнивать минимум 28-дневные периоды и учитывать релизы/сезонность.

## 7. Ежемесячный контроль

- 404/5xx, редиректы и доступность sitemap/robots.
- Индексируемые страницы и случайные URL кабинета в поиске.
- Запросы, показы, CTR, регистрации и конверсия публичного трафика.
- Изменения контента: добавлять `lastmod` только при наличии достоверной даты значимого обновления.
- Новые страницы включать в sitemap только после проверки уникального намерения, 200-ответа, canonical и содержательного HTML.
