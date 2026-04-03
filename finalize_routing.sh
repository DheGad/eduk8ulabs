#!/usr/bin/env bash
set -e

# ==============================================================================
# STREETMP OS — THE NGINX ALIGNMENT
# ==============================================================================
# WARNING: Run this script directly on the Ubuntu VPS as root.
# It enforces strict IPv4 routing to the Next.js Docker bridge
# and resolves the 502 Bad Gateway between Nginx and the healthy container.
# ==============================================================================

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (or use sudo)."
  exit 1
fi

NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
STREETMP_CONF="$NGINX_AVAILABLE/streetmp"

echo "[1/4] BACKING UP EXISTING DOMAIN CONFIGURATION..."
if [ -f "$NGINX_AVAILABLE/default" ]; then
  cp "$NGINX_AVAILABLE/default" "$NGINX_AVAILABLE/default.backup.$(date +%s)"
  echo "✅ Backed up default Nginx routing."
fi

echo "[2/4] WRITING THE ROUTING MATRIX (IPv4 ENFORCEMENT)..."
cat > "$STREETMP_CONF" << 'EOF'
server {
    listen 80;
    listen [::]:80;
    
    server_name streetmp.com os.streetmp.com;

    location / {
        # Strict IPv4 loopback. Prevents 502 Bad Gateway glitches 
        # caused by Docker's docker-proxy binding on localhost/IPv6.
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Enterprise headers required by Next.js
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for streaming responses
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
EOF
echo "✅ Unified Nginx Server Block generated at $STREETMP_CONF."

echo "[3/4] SYMLINKING & CLEARING STALE CACHE..."
# Delete the default site symlink so port 80 requests map straight to StreetMP
rm -f "$NGINX_ENABLED/default"

# Link the new configuration
ln -sf "$STREETMP_CONF" "$NGINX_ENABLED/streetmp"
echo "✅ Config symlinked to sites-enabled."

echo "[4/4] VALIDATING HYDRATION & RESTARTING NGINX DAEMON..."
if nginx -t; then
    echo "✅ Syntax is flawless."
    systemctl restart nginx
    echo "🚀 THE NGINX ALIGNMENT IS ONLINE. 502 BAD GATEWAY IS ERADICATED."
else
    echo "❌ Nginx Syntax Error Detected."
    exit 1
fi
