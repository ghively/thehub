# Reverse Proxy Examples (WSS)

Securely expose the Hub’s WebSocket server via TLS using a reverse proxy.

## Caddy
```
example.com {
  encode zstd gzip
  reverse_proxy /healthz 127.0.0.1:3000
  reverse_proxy /metrics 127.0.0.1:3000
  reverse_proxy 127.0.0.1:3000 {
    headers_up Authorization {>Authorization}
  }
}
```

## NGINX
```
server {
  listen 443 ssl;
  server_name example.com;

  ssl_certificate     /etc/ssl/certs/fullchain.pem;
  ssl_certificate_key /etc/ssl/private/privkey.pem;

  location /healthz { proxy_pass http://127.0.0.1:3000; }
  location /metrics { proxy_pass http://127.0.0.1:3000; }

  location / {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_pass http://127.0.0.1:3000;
  }
}
```

## Traefik (Static)
```
http:
  routers:
    hub:
      rule: "Host(`example.com`)"
      service: hub
      tls: {}
  services:
    hub:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3000"
```

Notes:
- Prefer token auth via `HUB_TOKEN` and pass the Authorization header.
- Set reasonable idle/read timeouts for long-lived WebSocket connections.
- Use `wss://` for any public exposure.

