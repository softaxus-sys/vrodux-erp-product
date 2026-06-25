#!/usr/bin/env bash
# ============================================================================
# Vrodux ERP — Server Bootstrap Script
# Target: Ubuntu 24.04 LTS (Contabo VPS: 8 vCPU / 24 GB / 200 GB NVMe)
#
# Usage: curl -sSL <raw-url>/scripts/server-bootstrap.sh | sudo bash
#    or: sudo bash scripts/server-bootstrap.sh
# ============================================================================
set -euo pipefail

# ── Color helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; }

# ── Pre-flight ─────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (sudo)."
    exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DOMAIN="${DOMAIN:-erp.vrodux.com}"
TIMEZONE="${TIMEZONE:-Asia/Dubai}"
SSH_PORT="${SSH_PORT:-22}"
APP_DIR="/opt/vrodux"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         Vrodux ERP — Server Bootstrap (Ubuntu 24.04)         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
info "Deploy user:  $DEPLOY_USER"
info "Domain:       $DOMAIN"
info "Timezone:     $TIMEZONE"
info "SSH Port:     $SSH_PORT"
info "App Dir:      $APP_DIR"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# 1. System Update & Essentials
# ═══════════════════════════════════════════════════════════════════════════
info "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    git \
    htop \
    iotop \
    jq \
    unzip \
    wget \
    tree \
    ncdu \
    net-tools \
    dnsutils \
    rsync \
    logrotate \
    cron \
    acl
success "System packages updated."

# ═══════════════════════════════════════════════════════════════════════════
# 2. Timezone & Locale
# ═══════════════════════════════════════════════════════════════════════════
info "Configuring timezone to $TIMEZONE..."
timedatectl set-timezone "$TIMEZONE"
success "Timezone set to $(timedatectl show --property=Timezone --value)."

# ═══════════════════════════════════════════════════════════════════════════
# 3. Deploy User
# ═══════════════════════════════════════════════════════════════════════════
info "Creating deploy user: $DEPLOY_USER..."
if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -m -s /bin/bash -G sudo "$DEPLOY_USER"
    mkdir -p /home/"$DEPLOY_USER"/.ssh
    chmod 700 /home/"$DEPLOY_USER"/.ssh
    # Copy root's authorized_keys if present
    if [[ -f /root/.ssh/authorized_keys ]]; then
        cp /root/.ssh/authorized_keys /home/"$DEPLOY_USER"/.ssh/authorized_keys
        chmod 600 /home/"$DEPLOY_USER"/.ssh/authorized_keys
    fi
    chown -R "$DEPLOY_USER":"$DEPLOY_USER" /home/"$DEPLOY_USER"/.ssh
    # Allow passwordless sudo for deploy user
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/"$DEPLOY_USER"
    chmod 440 /etc/sudoers.d/"$DEPLOY_USER"
    success "User $DEPLOY_USER created."
else
    warn "User $DEPLOY_USER already exists."
fi

# ═══════════════════════════════════════════════════════════════════════════
# 4. SSH Hardening
# ═══════════════════════════════════════════════════════════════════════════
info "Hardening SSH configuration..."
SSHD_CONFIG="/etc/ssh/sshd_config"
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.bak.$(date +%Y%m%d)"

cat > /etc/ssh/sshd_config.d/99-vrodux-hardening.conf <<SSHEOF
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
MaxAuthTries 3
MaxSessions 5
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 30
AllowUsers $DEPLOY_USER
SSHEOF

systemctl restart sshd
success "SSH hardened (port $SSH_PORT, key-only, root disabled)."

# ═══════════════════════════════════════════════════════════════════════════
# 5. UFW Firewall
# ═══════════════════════════════════════════════════════════════════════════
info "Configuring UFW firewall..."
apt-get install -y -qq ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow "$SSH_PORT"/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"

# Enable without prompt
echo "y" | ufw enable
ufw status verbose
success "UFW firewall configured."

# ═══════════════════════════════════════════════════════════════════════════
# 6. Fail2Ban
# ═══════════════════════════════════════════════════════════════════════════
info "Installing and configuring Fail2Ban..."
apt-get install -y -qq fail2ban

cat > /etc/fail2ban/jail.local <<'F2BEOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
backend  = systemd

[sshd]
enabled  = true
mode     = aggressive
maxretry = 3
bantime  = 86400
F2BEOF

systemctl enable fail2ban
systemctl restart fail2ban
success "Fail2Ban configured."

# ═══════════════════════════════════════════════════════════════════════════
# 7. Automatic Security Updates
# ═══════════════════════════════════════════════════════════════════════════
info "Enabling automatic security updates..."
apt-get install -y -qq unattended-upgrades

cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'UUEOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
UUEOF

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'AUEOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUEOF

success "Automatic security updates enabled."

# ═══════════════════════════════════════════════════════════════════════════
# 8. Docker Engine
# ═══════════════════════════════════════════════════════════════════════════
info "Installing Docker Engine..."

# Remove old versions
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do
    apt-get remove -y -qq "$pkg" 2>/dev/null || true
done

# Add Docker GPG key + repo
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add deploy user to docker group
usermod -aG docker "$DEPLOY_USER"

# Docker daemon config for production
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DOCKEREOF'
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "50m",
        "max-file": "5"
    },
    "storage-driver": "overlay2",
    "live-restore": true,
    "default-address-pools": [
        {"base": "172.17.0.0/12", "size": 24}
    ],
    "metrics-addr": "127.0.0.1:9323",
    "experimental": false
}
DOCKEREOF

systemctl enable docker
systemctl restart docker
success "Docker Engine installed: $(docker --version)"

# ═══════════════════════════════════════════════════════════════════════════
# 9. Swap Configuration (4 GB)
# ═══════════════════════════════════════════════════════════════════════════
info "Configuring swap (4 GB)..."
if ! swapon --show | grep -q "/swapfile"; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    if ! grep -q "/swapfile" /etc/fstab; then
        echo "/swapfile none swap sw 0 0" >> /etc/fstab
    fi
    success "4 GB swap created and enabled."
else
    warn "Swap already configured."
fi

# ═══════════════════════════════════════════════════════════════════════════
# 10. Sysctl Optimization
# ═══════════════════════════════════════════════════════════════════════════
info "Optimizing sysctl for ERP workloads..."
cat > /etc/sysctl.d/99-vrodux.conf <<'SYSEOF'
# --- Network ---
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.ip_local_port_range = 1024 65535

# --- Memory ---
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
vm.overcommit_memory = 1

# --- File system ---
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 512

# --- Security ---
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
SYSEOF

sysctl --system >/dev/null 2>&1
success "Sysctl optimized."

# ═══════════════════════════════════════════════════════════════════════════
# 11. Log Rotation
# ═══════════════════════════════════════════════════════════════════════════
info "Configuring log rotation..."
cat > /etc/logrotate.d/vrodux <<'LREOF'
/opt/vrodux/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
    sharedscripts
}
LREOF
success "Log rotation configured."

# ═══════════════════════════════════════════════════════════════════════════
# 12. Application Directory Structure
# ═══════════════════════════════════════════════════════════════════════════
info "Creating application directory structure..."
mkdir -p "$APP_DIR"/{releases,shared,logs,backups/{daily,weekly,monthly},scripts,ssl}
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR"
chmod 750 "$APP_DIR"
success "Application directories created at $APP_DIR."

# ═══════════════════════════════════════════════════════════════════════════
# 13. Certbot (Let's Encrypt)
# ═══════════════════════════════════════════════════════════════════════════
info "Installing Certbot..."
apt-get install -y -qq certbot
success "Certbot installed: $(certbot --version 2>&1 | head -1)"

# ═══════════════════════════════════════════════════════════════════════════
# 14. Cron Jobs (Backups + Docker Cleanup)
# ═══════════════════════════════════════════════════════════════════════════
info "Setting up cron jobs..."
cat > /etc/cron.d/vrodux <<CRONEOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Database backups
0 2 * * * $DEPLOY_USER $APP_DIR/scripts/backup-db.sh daily >> $APP_DIR/logs/backup.log 2>&1
0 3 * * 0 $DEPLOY_USER $APP_DIR/scripts/backup-db.sh weekly >> $APP_DIR/logs/backup.log 2>&1
0 4 1 * * $DEPLOY_USER $APP_DIR/scripts/backup-db.sh monthly >> $APP_DIR/logs/backup.log 2>&1

# Docker cleanup (remove dangling images/containers weekly)
0 5 * * 0 $DEPLOY_USER docker system prune -f --filter "until=168h" >> $APP_DIR/logs/docker-cleanup.log 2>&1

# Let's Encrypt renewal check (twice daily as recommended)
0 0,12 * * * root certbot renew --quiet --deploy-hook "docker exec vrodux-nginx nginx -s reload" >> $APP_DIR/logs/certbot.log 2>&1
CRONEOF

chmod 644 /etc/cron.d/vrodux
success "Cron jobs configured."

# ═══════════════════════════════════════════════════════════════════════════
# 15. Limits Configuration
# ═══════════════════════════════════════════════════════════════════════════
info "Setting system limits..."
cat > /etc/security/limits.d/99-vrodux.conf <<'LIMEOF'
*    soft    nofile    65535
*    hard    nofile    65535
*    soft    nproc     65535
*    hard    nproc     65535
LIMEOF
success "System limits set."

# ═══════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║            Server Bootstrap Complete!                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
success "Installed: Docker, UFW, Fail2Ban, Certbot, Unattended-Upgrades"
success "Created:   User '$DEPLOY_USER', App dir '$APP_DIR'"
success "Hardened:  SSH (port $SSH_PORT, key-only), sysctl, swap (4G)"
echo ""
warn "NEXT STEPS:"
echo "  1. Add your SSH public key to /home/$DEPLOY_USER/.ssh/authorized_keys"
echo "  2. Test SSH login as '$DEPLOY_USER' on port $SSH_PORT"
echo "  3. Copy .env.prod to $APP_DIR/shared/.env"
echo "  4. Run scripts/ssl-setup.sh to obtain SSL certificates"
echo "  5. Clone the repo and run the first deployment"
echo ""
warn "IMPORTANT: Verify you can SSH in as '$DEPLOY_USER' before closing this session!"
echo ""
