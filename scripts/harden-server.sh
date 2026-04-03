#!/usr/bin/env bash
# =============================================================================
# scripts/harden-server.sh
# StreetMP OS — "Fortress" Server Hardening Protocol
#
# Run ONCE on a freshly provisioned Ubuntu 22.04 server.
# MUST be run as root (or via sudo).
#
# What this script does:
#   1. Locks down SSH — key-only, no root login, no password auth
#   2. Configures UFW — allow only 80, 443, and SSH (default 22)
#   3. Installs and configures Fail2Ban — blocks brute-force
#   4. Applies kernel network hardening via sysctl
#   5. Disables unnecessary services
#   6. Verifies all changes and prints a summary
#
# Usage:
#   chmod +x scripts/harden-server.sh
#   sudo bash scripts/harden-server.sh [--ssh-port 22]
# =============================================================================
set -euo pipefail

# ── Parse arguments ──────────────────────────────────────────────
SSH_PORT=22
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ssh-port) SSH_PORT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ── Colors ────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}!${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
fail() { echo -e "  ${RED}✗${RESET}  $*"; exit 1; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    fail "This script must be run as root. Try: sudo bash $0"
  fi
}

# ── Header ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}============================================================${RESET}"
echo -e "${BOLD}${CYAN}  StreetMP OS — Fortress Hardening Protocol${RESET}"
echo -e "${CYAN}  $(date '+%Y-%m-%d %H:%M:%S %Z')${RESET}"
echo -e "${CYAN}  SSH port: ${SSH_PORT}${RESET}"
echo -e "${CYAN}============================================================${RESET}"
echo ""

require_root

# ── 1. SYSTEM UPDATE ─────────────────────────────────────────────
echo -e "${BOLD}[1/6] System Update${RESET}"
apt-get update -qq && apt-get upgrade -y -qq
ok "System packages updated"

# ── 2. SSH HARDENING ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}[2/6] SSH Hardening${RESET}"

SSHD_CONFIG="/etc/ssh/sshd_config"

# Backup original
cp "${SSHD_CONFIG}" "${SSHD_CONFIG}.bak.$(date +%Y%m%d)"
ok "Backed up original sshd_config"

# Apply hardened settings
cat > /etc/ssh/sshd_config.d/99-streetmp-fortress.conf << 'SSHEOF'
# StreetMP OS Fortress — SSH Hardening
# Applied by harden-server.sh

# Disable root login entirely
PermitRootLogin no

# Disable password authentication — SSH keys ONLY
PasswordAuthentication no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
UsePAM yes

# Disable empty passwords
PermitEmptyPasswords no

# Limit to one authentication attempt
MaxAuthTries 3

# Idle session timeout: 15 minutes
ClientAliveInterval 900
ClientAliveCountMax 0

# Disable X11 forwarding (not needed for a server)
X11Forwarding no

# Disable agent forwarding
AllowAgentForwarding no

# Only allow specific ciphers/MACs (hardened crypto)
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com
KexAlgorithms curve25519-sha256@libssh.org,diffie-hellman-group16-sha512
SSHEOF

# If custom SSH port is set, update it
if [[ "${SSH_PORT}" != "22" ]]; then
  echo "Port ${SSH_PORT}" >> /etc/ssh/sshd_config.d/99-streetmp-fortress.conf
  info "SSH port set to ${SSH_PORT}"
fi

# Validate config before restarting
sshd -t && ok "sshd config is valid"
systemctl restart sshd
ok "SSH daemon restarted with hardened config"
warn "Root login and password auth are now DISABLED. Ensure your SSH key is loaded before closing this session."

# ── 3. UFW FIREWALL ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}[3/6] UFW Firewall Configuration${RESET}"

# Install UFW if missing
apt-get install -y -qq ufw

# Reset to clean state (non-interactively)
ufw --force reset

# Default: deny all inbound, allow all outbound
ufw default deny incoming
ufw default allow outgoing

# Allow only the required ports
ufw allow "${SSH_PORT}/tcp"   comment "SSH"
ufw allow 80/tcp              comment "HTTP (Caddy → HTTPS redirect)"
ufw allow 443/tcp             comment "HTTPS (Caddy)"
ufw allow 443/udp             comment "HTTPS/QUIC (HTTP3)"

# Explicitly deny all microservice ports from external access
for port in 4000 4001 4002 4003 4004 4005 4007 4008 4009 5432 6379; do
  ufw deny "${port}/tcp" comment "Internal only: blocked from public"
done

# Enable UFW non-interactively
ufw --force enable
ok "UFW enabled — only ports ${SSH_PORT}, 80, 443 are open"

ufw status verbose

# ── 4. FAIL2BAN ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[4/6] Fail2Ban Brute-Force Protection${RESET}"

apt-get install -y -qq fail2ban

# Fail2Ban jail config for SSH
cat > /etc/fail2ban/jail.d/streetmp-ssh.conf << JAILEOF
[sshd]
enabled  = true
port     = ${SSH_PORT}
filter   = sshd
backend  = systemd
logpath  = %(sshd_log)s
maxretry = 4
findtime = 300
bantime  = 3600
ignoreip = 127.0.0.1/8 ::1

[sshd-ddos]
enabled  = true
port     = ${SSH_PORT}
filter   = sshd-ddos
backend  = systemd
logpath  = %(sshd_log)s
maxretry = 6
findtime = 60
bantime  = 86400
JAILEOF

systemctl enable fail2ban
systemctl restart fail2ban
ok "Fail2Ban active — SSH brute-force protection enabled"
ok "Max 4 retry attempts, ban duration: 1 hour"

# ── 5. KERNEL NETWORK HARDENING (sysctl) ─────────────────────────
echo ""
echo -e "${BOLD}[5/6] Kernel Network Hardening${RESET}"

cat > /etc/sysctl.d/99-streetmp-fortress.conf << 'SYSCTLEOF'
# StreetMP OS Fortress — Kernel hardening

# Ignore ICMP broadcast pings (prevents smurf attacks)
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Protect against IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Disable source routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Disable ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0

# Enable SYN cookies (prevents SYN flood attacks)
net.ipv4.tcp_syncookies = 1

# Increase backlog for high-traffic TCP connections
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192

# Log suspicious packets
net.ipv4.conf.all.log_martians = 1
SYSCTLEOF

sysctl -p /etc/sysctl.d/99-streetmp-fortress.conf -q
ok "Kernel network hardening applied (anti-spoof, SYN cookies, redirect protection)"

# ── 6. DISABLE UNNECESSARY SERVICES ─────────────────────────────
echo ""
echo -e "${BOLD}[6/6] Disabling Unnecessary Services${RESET}"

DISABLE_SVCS=(
  avahi-daemon   # mDNS — not needed on a server
  cups           # Print service
  rpcbind        # NFS portmapper — not used
  snapd          # Snap daemon — unnecessary overhead
)

for svc in "${DISABLE_SVCS[@]}"; do
  if systemctl is-active --quiet "${svc}" 2>/dev/null; then
    systemctl disable --now "${svc}" 2>/dev/null && warn "Disabled: ${svc}"
  fi
done
ok "Unnecessary services disabled"

# ── DOCKER INSTALL CHECK ─────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo ""
  info "Docker not found — installing..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  ok "Docker installed and started"
fi

# ── SUMMARY ──────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}============================================================${RESET}"
echo -e "${BOLD}${GREEN}  ✓ FORTRESS HARDENING COMPLETE${RESET}"
echo -e "${CYAN}============================================================${RESET}"
echo ""
echo -e "  SSH:      Key-only, root login disabled, port ${SSH_PORT}"
echo -e "  Firewall: UFW active — open ports: ${SSH_PORT}, 80, 443 only"
echo -e "  Fail2Ban: Active — brute-force protection on SSH"
echo -e "  Kernel:   SYN cookies, RP filter, redirect block applied"
echo ""
echo -e "${YELLOW}${BOLD}  NEXT STEP:${RESET} Deploy StreetMP OS with:"
echo -e "  cd /opt/streetmp-os && docker compose -f docker-compose.prod.yml up -d --build"
echo ""
