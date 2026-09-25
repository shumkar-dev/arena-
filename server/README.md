# Игровой сервер «Всадников Арены»

Комнаты по коду: 1 на 1, 2 на 2 и каждый сам за себя, свободные места — боты. Сервер авторитетный: бой считает он тем же кодом, что и игра (`src/game/match.js`), телефоны шлют только команды (джойстик, удар, ульта). Протокол — `src/net/protocol.js`, устройство — `docs/ARCHITECTURE.md`.

- Node.js + WebSocket (`ws`), 30 шагов боя в секунду, снимок игрокам после каждого шага.
- Docker-образ на `node:22-alpine`, код сервера — один файл ~600 КБ.
- Слушает только `127.0.0.1:3001`, наружу — через Caddy по пути `/arena-ws`.
- Игра подключается к `wss://vsadniki.duckdns.org/arena-ws` (другой адрес — переменная сборки `VITE_ARENA_WS` или `?ws=…` в адресе страницы).

## Установка на VPS (один раз)

Подключись по SSH:
```bash
ssh root@<IP сервера>
```

### 1. Проверить место
```bash
df -h /
docker system df
```
Для сборки нужно ~400 МБ на время. После сборки кэш удаляем, остаётся ~180 МБ (образ `node:alpine`, общий с другими контейнерами на alpine).

### 2. Скачать код
```bash
cd /opt
git clone --depth 1 https://github.com/shumkar-dev/arena-.git arena
cd /opt/arena
```

### 3. Собрать и запустить
```bash
docker compose -f server/docker-compose.yml up -d --build
```
Если команда `docker compose` не найдена — попробуй `docker-compose` (с дефисом) или то же без compose:
```bash
docker build -f server/Dockerfile -t vsadniki-arena-server .
docker run -d --name arena-server --restart unless-stopped -p 127.0.0.1:3001:3001 --memory 256m \
  --log-opt max-size=5m --log-opt max-file=2 vsadniki-arena-server
```

Убрать кэш сборки, чтобы вернуть место:
```bash
docker builder prune -af
docker image prune -f
```
(удаляют только кэш сборки и образы без имени — n8n, evolution-api, postgres и qdrant не трогают)

Проверить, что сервер жив:
```bash
curl -s http://127.0.0.1:3001/
# arena server ok, rooms: 0
docker logs --tail 20 arena-server
```

### 4. Caddy
Сделай копию конфига:
```bash
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F)
nano /etc/caddy/Caddyfile
```
В блоке `vsadniki.duckdns.org { … }` вставь **перед последним** `handle {` (тем, что отдаёт статический сайт) — после блоков `/apps*`, `/quiz*`, `/memes*`, их не трогай:
```caddyfile
	handle /arena-ws* {
		reverse_proxy 127.0.0.1:3001
	}
```
Должно получиться примерно так:
```caddyfile
vsadniki.duckdns.org {
	handle_path /apps* { … }
	handle_path /quiz* { … }
	handle_path /memes* { … }

	handle /arena-ws* {
		reverse_proxy 127.0.0.1:3001
	}

	handle {
		… статический сайт …
	}
}
```
WebSocket Caddy пробрасывает сам, ничего больше не нужно. Сохрани (в nano: Ctrl+O, Enter, Ctrl+X), проверь и перезагрузи Caddy:
```bash
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
systemctl status caddy --no-pager | head -5
```
`reload` применяет конфиг без остановки остальных сайтов. Если `validate` ругается — верни копию: `cp /etc/caddy/Caddyfile.bak-<дата> /etc/caddy/Caddyfile`.

Проверка снаружи (с любого компьютера):
```bash
curl -s https://vsadniki.duckdns.org/arena-ws
# arena server ok, rooms: 0
```

Порт 3001 наружу не открыт (слушает только 127.0.0.1), в firewall ничего менять не нужно.

## Обновление
После слияния новых изменений в main:
```bash
cd /opt/arena
git pull
docker compose -f server/docker-compose.yml up -d --build
docker builder prune -af && docker image prune -f
```
Идущие бои при перезапуске прервутся (у игроков появится «Связь с сервером потеряна»).

Если в обновлении изменилась версия протокола (`PROTOCOL` в `src/net/protocol.js`), обнови сервер сразу после деплоя сайта: пока версии расходятся, игра покажет «Обнови игру» или «Сервер обновляется» вместо боя.

## Полезное
```bash
docker logs -f arena-server                               # журнал (комнаты, начало и конец боёв)
docker restart arena-server                               # перезапуск
docker compose -f server/docker-compose.yml down          # остановить и удалить контейнер
```

## Разработка
```bash
npm run server                      # собрать и запустить сервер на :3001
npm run dev                         # игра; открыть http://localhost:5173/arena-/?ws=ws://localhost:3001
```
