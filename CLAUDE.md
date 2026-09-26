# CLAUDE.md — «Всадники Арены»

Памятка для следующих сессий. Подробности: `docs/GDD.md` (дизайн игры), `docs/ARCHITECTURE.md` (устройство), `README.md`, `server/README.md` (сервер).

## Проект
Мобильная 3D-арена для игры с друзьями в стиле Brawl Stars: блочная графика, телефон в горизонтали, тёмно-красное меню.
- Стек: React 18 + three.js + Vite; PWA. Игра: https://shumkar-dev.github.io/arena-/ (репозиторий `shumkar-dev/arena-`, `base: '/arena-/'`).
- Герои (по папке на героя, `src/heroes/<id>/`: `model.js`, `kit.js`, `index.js`): Шаба, Смитана, Чёрный Изюм, Гаргашмель. Реестр собирается через `import.meta.glob`.
- Режимы (`src/modes/<id>.js`): `duel` (1 на 1, до 3 убийств), `teams` (2 на 2, бутылки «Султан чая», сигареты), `ffa` (каждый сам за себя в парке, прохожие, аптечки), `training`. Карты — `src/maps/` (дорога, парк).
- Боты (`src/game/bot.js`): 10 ботов с игровыми никами, сила растёт со званием игрока (`botSkill`).
- Рейтинг — утки и звания строго по GDD (`src/rating/ranks.js`); таблица в Supabase (`src/rating/store.js`, `docs/supabase.sql`), без ключей — на устройстве.
- Звук: процедурные звуки (`sound.js`), голоса героев (`voice.js`, `public/voices/<голос>_<событие>.mp3`), музыка (`music.js`, `public/music/`). Три канала громкости; музыка — фон (−9 дБ, приглушается под реплики).
- Мультиплеер: комнаты по коду во всех трёх режимах, авторитетный сервер `server/` (Node + ws).

## Архитектура (коротко)
- `src/game/match.js` — симуляция без картинки: бойцы, команды `{ moveX, moveZ, aimDir, attack?, ult? }`, события в `match.events`. Её же запускает сервер.
- Контроллеры (`controllers.js`): `local` (кнопки; `flip` — у игрока на севере оси перевёрнуты), `bot`, `remote` (сеть).
- Режим: `setup(match, opts)` принимает готовый состав `opts.roster` + `opts.you` (сеть) или строит «ты + боты» (`rosterOf` в `modes/common.js`); `slots`, `teamOf(i)`, `onDeath`, `update`, `hud`, у `teams` — `deathFx`.
- `engine.js` — рендер, камера, HUD, реплики; при `options.net` — сетевой режим через `src/net/sync.js`.
- Сеть (`src/net/`): `protocol.js` — общий с сервером (`PROTOCOL`, `createOnlineMode`, `packFighter`/`diffFighter`), `client.js` — WebSocket, пинг, сверка версий, `sync.js` — предсказание своего бойца, интерполяция остальных (150 мс), урон/смерти/счёт/предметы — только с сервера.
- Снимки: 15/с, только изменения, целые числа, permessage-deflate (~0,6–1,7 КБ/с вниз). Затор: игрок шлёт номер последнего снимка `k`, сервер пропускает снимки, а не копит очередь.
- Итог и утки сетевого боя считает сервер (`results.js` + `rewardFor`); свои утки пишет каждый телефон, утки ботов — только телефон создателя комнаты.
- Обновления: версия сборки (`__APP_VERSION__`, `version.json`), плашка «Доступно обновление» (`src/ui/update.js`); `sw.js?v=<версия>`. Версия протокола — `PROTOCOL`: **увеличить при любом несовместимом изменении сообщений/снимков**.

## Деплой
**Игра** — GitHub Actions (`.github/workflows/deploy.yml`) на каждый push в `main` → GitHub Pages. Переменные репозитория (Settings → Secrets and variables → Actions → Variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (ключ `sb_publishable_…`; хвост `/rest/v1/` в URL код убирает сам).

**Сервер мультиплеера** — VPS в Швеции (Ubuntu, root, мало места ~1 ГБ). Рядом в Docker работают n8n, evolution-api, postgres, qdrant — не трогать.
- Код: `/opt/arena` (git clone). Контейнер `arena-server` (`server/docker-compose.yml`, node:22-alpine), слушает только `127.0.0.1:3001`, `restart: unless-stopped`.
- Caddy на хосте, `/etc/caddy/Caddyfile`, домен `vsadniki.duckdns.org`: блок `handle /arena-ws* { reverse_proxy 127.0.0.1:3001 }` стоит перед последним `handle` (статический сайт); блоки `/apps*`, `/quiz*`, `/memes*` не трогать. Игра подключается к `wss://vsadniki.duckdns.org/arena-ws`.
- Обновление сервера (после слияния в main, если менялись `server/` или `src/net`, режимы, герои):
  ```bash
  cd /opt/arena && git pull
  docker compose -f server/docker-compose.yml up -d --build
  docker builder prune -af && docker image prune -f
  curl -s http://127.0.0.1:3001/      # arena server ok, rooms: N
  ```
  Журнал: `docker logs --tail 30 arena-server` (в конце матча — КБ/с и пропуски снимков на игрока). Caddy при обновлении трогать не нужно.

## Разработка и проверка
- `npm run dev`, `npm run build`, `npm run build:server`, `npm run server` (сервер на :3001), `npm run balance`.
- Параметры адреса: `?mode=`, `?hero=`, `?bot=`, `?dummy`, `?autoplay`, `?fast=N`, `?debug` (`window.__game`), `?ws=ws://localhost:3001`.
- Сервер: `LAG_MS=100` — искусственная задержка в каждую сторону.
- Тесты — через `playwright-core` с `/opt/pw-browsers/chromium` (`--use-gl=angle --use-angle=swiftshader`); без лишних долгих автотестов, пользователь просит короткие проверки.
- Аудио — `scripts/audio.sh <папка>` (нужен ffmpeg; в песочнице: `pip install imageio-ffmpeg`).
- Ограничения песочницы: github.io и supabase.co недоступны (прокси), демона Docker нет.

## Как работать с автором
- Общение и тексты в игре — по-русски. Пол персонажей не угадывать — нейтральные формулировки.
- Каждая просьба — один PR в `main`; после PR коротко написать, что проверить на телефоне, и, если менялся сервер, — команды обновления VPS.
- Не трогать файлы-превью `src/characters/*-blocky.jsx`.
- Ветка разработки — `claude/wizardly-maxwell-gei6zq`; если её PR уже слит — начать заново от свежего `main`.

## Состояние и что осталось
Готово: этапы 1–9 GDD, меню, рейтинг на Supabase, мультиплеер во всех режимах с лобби (режим и герой выбираются в комнате), голоса и музыка, оптимизация сети, автообновление.

Осталось / идеи:
- Озвучка Шабы (`shaba_*`) и реплика смерти Гаргашмеля (`garga_death` удалён — в исходнике была реплика убийства).
- Бутылка «Султан чая» — пока временная блочная модель (по GDD автор пришлёт фото).
- Проверить на реальном мобильном интернете (Кыргызстан → Швеция) пинг после оптимизации сети; если высок при малых пропусках — дело в канале.
- Подбор случайных соперников без кода; выбор карты в лобби.
- Защита рейтинга от подделки (утки пишет телефон; функция в Supabase ограничивает ±15 за раз).
