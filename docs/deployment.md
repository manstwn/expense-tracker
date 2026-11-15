# Deployment

The app is a single Node.js process. It can run under systemd, a process manager, or a container. The Cloudflare Tunnel can run inside the app (`ENV=prod` and `CL_TUNNEL_TOKEN`) or be managed separately.

## Requirements

- Node.js >= 20.19.0
- MongoDB reachable from the host
- `.env` populated from `.env.example`
- `TOKEN_SECRET` set (required in production)
- `WEB_PIN` at least 6 characters
- `IOT_TOKEN` set only if a device uses `/iot`

## systemd example

```ini
[Unit]
Description=Expense Tracker Dashboard
After=network-online.target

[Service]
Type=simple
User=expense
WorkingDirectory=/opt/expense-tracker
EnvironmentFile=/opt/expense-tracker/.env
ExecStart=/usr/bin/node main.js
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=15

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now expense-tracker
```

## Docker

```bash
docker build -t expense-tracker .
docker run --rm --env-file .env -p 3000:3000 expense-tracker
```

The tunnel binary is installed by the `cloudflared` npm package. In production behind Cloudflare, `ENV=prod` enables secure cookies and `trust proxy`.

## Health checks

Use `GET /healthz`:

- `200` means the HTTP process and MongoDB are reachable.
- `503` means MongoDB is unavailable.

Point the load balancer or container health check at that endpoint.

## Logs

The server writes JSON lines with a timestamp, level, and request ID. Do not log request bodies or the `Authorization` header. Ship logs to your normal collector.

## Backups

Back up MongoDB before deploying changes that affect data shape or owner IDs. Use `scripts/normalize-owner.js` as a dry run first; it never applies changes unless `--apply` is passed.
