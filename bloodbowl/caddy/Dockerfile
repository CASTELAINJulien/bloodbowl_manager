FROM caddy:2-alpine

# Intègre la config et le frontend dans l'image (pas de bind mount)
COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY frontend /srv
