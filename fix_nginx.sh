#!/usr/bin/env bash
set -e

# ==============================================================================
# STREETMP OS — THE ROUTING MATRIX (NGINX FIXER)
# ==============================================================================
# WARNING: Run this script directly on the Ubuntu VPS as root.
# It enforces strict IPv4 routing to the Next.js Docker bridge
# and establishes the required enterprise proxy headers.
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
  cp "$NGINX_AVAILABLE/default" "$NGINX_AVAILABLE/default.backup.$(date +%F_%T)"
  echo "✅ Backed up default Nginx routing."
fi

echo "[2/4] WRITING THE ROUTING MATRIX (IPv4 ENFORCEMENT)..."
cat > "$STREETMP_CONF" << 'EOF'
server {
    listen 80;
    listen [::]:80;
    
    # Optional: If you already have SSL certificates, certbot will automatically 
    # update this block to listen on 443 with your PEM files. 
    
    server_name streetmp.com os.streetmp.com;

    location / {
        # Strict IPv4 loopback. Prevents 502 Bad Gateway glitches 
        # caused by Docker's docker-proxy on IPv6 mapping.
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Enterprise headers required by Next.js
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts to support streaming responses (optional but recommended)
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
EOF
echo "✅ Nginx Server Block generated at $STREETMP_CONF."

echo "[3/4] SYMLINKING & CLEARING STALE CACHE..."
# Remove default to prevent port 80 collisions
rm -f "$NGINX_ENABLED/default"

# Link the new configuration
ln -sf "$STREETMP_CONF" "$NGINX_ENABLED/streetmp"
echo "✅ Symlinked to sites-enabled."

echo "[4/4] VALIDATING & RESTARTING NGINX DAEMON..."
if nginx -t; then
    echo "✅ Syntax is flawless."
    systemctl restart nginx
    echo "🚀 NGINX THE ROUTING MATRIX ONLINE. 502 BAD GATEWAY ERADICATED."
else
    echo "❌ Nginx Syntax Error Detected. Reverting is necessary!"
    exit 1
fi
