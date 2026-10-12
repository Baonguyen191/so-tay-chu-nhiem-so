#!/usr/bin/env bash
# Cài Sổ tay Chủ nhiệm số (bản nhà trường) lên VPS Ubuntu 22.04 / 24.04.
#
# Cách dùng (chạy bằng quyền root trên VPS):
#   DOMAIN=sotay.tentruong.edu.vn bash cai-dat-vps.sh
# Chưa có tên miền: dùng tên miền miễn phí theo địa chỉ IP của VPS, ví dụ 103.20.30.40 → 103-20-30-40.sslip.io
#   DOMAIN=103-20-30-40.sslip.io bash cai-dat-vps.sh
# Đổi tên miền: chạy lại với DOMAIN mới; ALIASES liệt kê tên miền cũ (và www) để tự chuyển sang tên miền mới:
#   DOMAIN=tentruong.vn ALIASES="www.tentruong.vn sotay.tenmiencu.xyz" bash cai-dat-vps.sh
#
# Chạy lại nhiều lần không sao: lần sau chỉ cập nhật mã và cấu hình, dữ liệu giữ nguyên.
set -euo pipefail

DOMAIN="${DOMAIN:-}"
ALIASES="${ALIASES:-}"
REPO="${REPO:-https://github.com/Baonguyen191/so-tay-chu-nhiem-so.git}"
BRANCH="${BRANCH:-main}"
APP_DIR=/opt/so-tay/app
DATA_DIR=/var/lib/so-tay
PORT=3000

if [[ $EUID -ne 0 ]]; then echo "Hãy chạy bằng quyền root (sudo)."; exit 1; fi
if [[ -z "$DOMAIN" ]]; then echo "Thiếu tên miền. Ví dụ: DOMAIN=sotay.tentruong.edu.vn bash $0"; exit 1; fi

echo "==> Múi giờ Việt Nam (ngày điểm danh, tên file sao lưu)"
timedatectl set-timezone Asia/Ho_Chi_Minh || true

echo "==> Cài gói hệ thống"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw gnupg ca-certificates debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]]; then
  echo "==> Cài Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  echo "==> Cài Caddy (máy chủ HTTPS, tự xin chứng chỉ miễn phí)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> Tài khoản hệ thống riêng cho ứng dụng"
id sotay >/dev/null 2>&1 || useradd --system --home-dir /opt/so-tay --create-home --shell /usr/sbin/nologin sotay
install -d -o sotay -g sotay -m 700 "$DATA_DIR" "$DATA_DIR/sao-luu"

echo "==> Lấy mã nguồn"
if [[ -d "$APP_DIR/.git" ]]; then
  sudo -u sotay git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  sudo -u sotay git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  install -d -o sotay -g sotay "$(dirname "$APP_DIR")"
  sudo -u sotay git clone --quiet --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
# better-sqlite3 đã kèm sẵn bản dựng cho Linux/Windows; --ignore-scripts để npm không tự biên dịch lại (VPS thường không có make, g++).
sudo -u sotay npm ci --omit=dev --ignore-scripts --no-audit --no-fund

echo "==> Cấu hình"
cat > /etc/so-tay.env <<EOF
PORT=$PORT
HOST=127.0.0.1
DATA_DIR=$DATA_DIR
TRUST_PROXY=1
BACKUP_KEEP=14
NODE_ENV=production
EOF
chmod 640 /etc/so-tay.env

cat > /etc/systemd/system/so-tay.service <<EOF
[Unit]
Description=So tay Chu nhiem so
After=network.target

[Service]
User=sotay
Group=sotay
WorkingDirectory=$APP_DIR
EnvironmentFile=/etc/so-tay.env
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  encode gzip
  reverse_proxy 127.0.0.1:$PORT
}
EOF
if [[ -n "$ALIASES" ]]; then
  cat >> /etc/caddy/Caddyfile <<EOF

$(echo "$ALIASES" | tr ', ' '\n\n' | grep -v '^$' | paste -sd, - | sed 's/,/, /g') {
  redir https://$DOMAIN{uri} permanent
}
EOF
fi

echo "==> Tường lửa: chỉ mở SSH, HTTP, HTTPS"
if command -v netfilter-persistent >/dev/null && iptables -S INPUT | grep -q -- "-j REJECT"; then
  # Ảnh Ubuntu của Oracle Cloud có sẵn luật iptables chặn mọi cổng trừ SSH:
  # mở thêm 80, 443 ngay trước luật REJECT rồi lưu lại (không bật ufw để tránh xung đột).
  for p in 80 443; do
    if ! iptables -C INPUT -p tcp -m state --state NEW --dport "$p" -j ACCEPT 2>/dev/null; then
      line=$(iptables -L INPUT --line-numbers | awk '/REJECT/{print $1; exit}')
      iptables -I INPUT "$line" -p tcp -m state --state NEW --dport "$p" -j ACCEPT
    fi
  done
  netfilter-persistent save >/dev/null
  echo "    (Oracle Cloud: nhớ mở cổng 80, 443 trong Security List của mạng VCN)"
else
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
fi

echo "==> Khởi động"
systemctl daemon-reload
systemctl enable --now so-tay
systemctl restart so-tay
systemctl reload caddy || systemctl restart caddy

sleep 2
if curl -fsS "http://127.0.0.1:$PORT/api/state" >/dev/null; then
  echo
  echo "Xong. Mở https://$DOMAIN để tạo tài khoản quản trị đầu tiên."
  echo "Dữ liệu: $DATA_DIR/sotay.sqlite · Sao lưu tự động: $DATA_DIR/sao-luu/"
  echo "Xem nhật ký: journalctl -u so-tay -f"
else
  echo "Ứng dụng chưa chạy. Xem lỗi: journalctl -u so-tay -n 50"
  exit 1
fi
