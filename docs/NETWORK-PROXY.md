# InsyncOwn proxy — sync without a system-wide VPN

## The problem

In some regions (including Myanmar), **Google APIs are blocked** on the normal internet route. A full-system VPN fixes sync but can break banking apps, local services, or other tools that must stay on the direct route.

## The InsyncOwn solution

InsyncOwn can send **only rclone / Google Drive traffic** through a proxy. Everything else on your PC stays on your normal connection.

```text
Your apps  ──────────────────────────►  Internet (direct)
InsyncOwn  ──► local proxy ──► VPN/tunnel ──► Google Drive
```

## Recommended setup (Myanmar)

### Option A — VPN with a local SOCKS port (best if your VPN supports it)

Many VPN clients can expose **SOCKS5 on localhost** without routing all traffic:

1. Enable SOCKS5 in your VPN app (often `127.0.0.1:1080` or similar).
2. **Turn off full-tunnel / disable system VPN** if the app allows “proxy only” mode.
3. In InsyncOwn → **Network / proxy**:
   ```text
   Proxy URL: socks5://127.0.0.1:1080
   No proxy:  127.0.0.1,localhost
   ```
4. Click **Save proxy**, then **Test Google Drive**.

Only InsyncOwn uses the proxy. Other programs ignore it.

### Option B — SSH SOCKS tunnel (no VPN app needed)

If you have a server outside Myanmar:

```bash
ssh -D 1080 -N user@your-server-abroad
```

Then in InsyncOwn:

```text
Proxy URL: socks5://127.0.0.1:1080
```

Leave the SSH session running while syncing.

### Option C — HTTP proxy (Clash, v2rayN, etc.)

If your tool exposes an HTTP proxy on localhost:

```text
Proxy URL: http://127.0.0.1:7890
```

Use the port shown in your proxy app's settings.

## OAuth / browser login

- **rclone token exchange** (daemon → Google) uses the InsyncOwn proxy.
- **Browser login** (Google sign-in page) uses your **browser's** network. If the browser cannot reach Google either, connect briefly for login only, or configure the browser to use the same SOCKS proxy once.

After login, day-to-day sync runs through InsyncOwn's proxy setting.

## systemd (advanced)

You can lock proxy via environment instead of the UI:

```ini
[Service]
Environment=INSYNCOWN_PROXY=socks5://127.0.0.1:1080
Environment=INSYNCOWN_NO_PROXY=127.0.0.1,localhost
```

When `INSYNCOWN_PROXY` is set, the UI shows it as env-locked.

File location for UI settings: `~/.config/insyncown/network.json`

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Test fails, no proxy | Google blocked — set a proxy URL |
| Test fails with proxy | Check SOCKS/HTTP proxy is running; verify port |
| Sync works, browser login fails | Use VPN briefly for login, or set browser proxy |
| Other apps break when VPN on | Use local SOCKS + InsyncOwn proxy only (Option A/B) |

## What domains need to work through the proxy

rclone talks to Google APIs, typically:

- `*.googleapis.com`
- `accounts.google.com` (during auth)
- `oauth2.googleapis.com`

Your proxy or SSH tunnel must allow HTTPS to these.
