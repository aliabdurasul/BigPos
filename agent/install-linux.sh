#!/usr/bin/env bash
# BigPOS Agent — Linux systemd service installer
# Usage: sudo bash install-linux.sh

set -e

SERVICE_NAME="bigpos-agent"
INSTALL_DIR="/opt/bigpos-agent"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
RUN_USER="${SUDO_USER:-bigpos}"

echo "Installing BigPOS Agent to ${INSTALL_DIR}..."

# Create install dir
mkdir -p "${INSTALL_DIR}"
cp -r dist package.json "${INSTALL_DIR}/"
cd "${INSTALL_DIR}" && npm install --omit=dev --ignore-scripts

# Create system user if not exists
if ! id "${RUN_USER}" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "${RUN_USER}"
fi

chown -R "${RUN_USER}:${RUN_USER}" "${INSTALL_DIR}"

# Write systemd unit file
cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=BigPOS Local Print Agent
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node ${INSTALL_DIR}/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bigpos-agent

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full
ProtectHome=read-only

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl start  "${SERVICE_NAME}"

echo ""
echo "BigPOS Agent installed and started."
echo "Check status: systemctl status ${SERVICE_NAME}"
echo "View logs:    journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "Provision the agent by creating ~/.bigpos-agent/keystore.json"
echo "Then restart: systemctl restart ${SERVICE_NAME}"
