#!/usr/bin/env bash
# ============================================================
# setup-secrets.sh — One-time GitHub Actions Secret Provisioner
# ============================================================
#
# Run this ONCE from your local machine after:
#   1. Installing the GitHub CLI: brew install gh
#   2. Authenticating:           gh auth login
#   3. Making the script executable: chmod +x setup-secrets.sh
#
# Usage:
#   ./setup-secrets.sh
#
# The script will prompt you for each value interactively.
# Nothing is logged to disk.
# ============================================================

set -euo pipefail

# ── Prerequisites check ────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "[ERROR] GitHub CLI (gh) is not installed."
  echo "        Install it with: brew install gh"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "[ERROR] Not authenticated with GitHub CLI."
  echo "        Run: gh auth login"
  exit 1
fi

# ── Detect repo from git remote ───────────────────────────────────
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [[ -z "$REPO" ]]; then
  echo "[ERROR] Could not detect GitHub repository."
  echo "        Make sure you are inside the git repo directory."
  exit 1
fi

echo ""
echo "============================================================"
echo "  StreetMP OS — GitHub Secrets Setup"
echo "  Repository: ${REPO}"
echo "============================================================"
echo ""

# ── Helper: prompt for a secret value and set it ─────────────────
set_secret() {
  local name="$1"
  local prompt_text="$2"
  local value=""

  echo "──────────────────────────────────────────────"
  echo "Secret: ${name}"
  echo "Prompt: ${prompt_text}"
  echo ""

  # Use -s to suppress terminal echo (no value appears on screen)
  read -r -s -p "Value (input hidden): " value
  echo ""  # newline after hidden input

  if [[ -z "$value" ]]; then
    echo "[SKIP] No value entered — skipping ${name}"
    return
  fi

  echo "$value" | gh secret set "$name" --repo "$REPO"
  echo "[OK] Set ${name}"
  echo ""
}

# ── Secret: SSH private key ────────────────────────────────────────
echo "──────────────────────────────────────────────"
echo "Secret: DEPLOY_SSH_KEY"
echo "Prompt: Paste the FULL content of your private SSH key"
echo "        (e.g. the contents of ~/.ssh/id_rsa or id_ed25519)."
echo "        Paste, then press Enter, then Ctrl+D to submit."
echo ""
DEPLOY_SSH_KEY=$(cat)
echo "$DEPLOY_SSH_KEY" | gh secret set "DEPLOY_SSH_KEY" --repo "$REPO"
echo "[OK] Set DEPLOY_SSH_KEY"
echo ""

# ── Secret: known_hosts entry ─────────────────────────────────────
echo "──────────────────────────────────────────────"
echo "Secret: DEPLOY_KNOWN_HOST"
echo "Prompt: Run the following command locally and paste the output:"
echo ""
echo "        ssh-keyscan -H <your-server-ip>"
echo ""
echo "Paste output, then press Enter, then Ctrl+D:"
echo ""
DEPLOY_KNOWN_HOST=$(cat)
echo "$DEPLOY_KNOWN_HOST" | gh secret set "DEPLOY_KNOWN_HOST" --repo "$REPO"
echo "[OK] Set DEPLOY_KNOWN_HOST"
echo ""

# ── Remaining plain-text secrets ──────────────────────────────────
set_secret "DEPLOY_HOST"    "VPS IP or hostname (e.g. 187.127.131.212)"
set_secret "DEPLOY_USER"    "SSH user on the VPS (e.g. root or deploy)"
set_secret "DEPLOY_APP_DIR" "Absolute path to the app on the VPS (e.g. /var/www/streetmp-os)"

# ── Optional: Watchtower API token ────────────────────────────────
echo "──────────────────────────────────────────────"
echo "Secret: WATCHTOWER_API_TOKEN (optional)"
echo "Prompt: A random string to secure the Watchtower metrics endpoint."
echo "        Leave blank to skip."
echo ""
read -r -s -p "Value (input hidden, Enter to skip): " WT_TOKEN
echo ""
if [[ -n "$WT_TOKEN" ]]; then
  echo "$WT_TOKEN" | gh secret set "WATCHTOWER_API_TOKEN" --repo "$REPO"
  echo "[OK] Set WATCHTOWER_API_TOKEN"
else
  echo "[SKIP] Watchtower token not set — default 'changeme' will be used."
fi

echo ""
echo "============================================================"
echo "  All secrets provisioned for ${REPO}."
echo "  Your next push to 'main' will trigger the Titan Deploy"
echo "  workflow automatically."
echo "============================================================"
echo ""
