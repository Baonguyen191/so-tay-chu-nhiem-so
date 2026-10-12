#!/usr/bin/env bash
# Cập nhật Sổ tay Chủ nhiệm số trên VPS lên bản mới nhất trên GitHub. Dữ liệu giữ nguyên.
# Chạy bằng quyền root:  bash /opt/so-tay/app/deploy/cap-nhat.sh
set -euo pipefail
APP_DIR=/opt/so-tay/app
BRANCH="${BRANCH:-main}"

if [[ $EUID -ne 0 ]]; then echo "Hãy chạy bằng quyền root (sudo)."; exit 1; fi
DATA_DIR=$(grep '^DATA_DIR=' /etc/so-tay.env | cut -d= -f2)
PORT=$(grep '^PORT=' /etc/so-tay.env | cut -d= -f2)

echo "==> Sao lưu trước khi cập nhật"
install -d -o sotay -g sotay -m 700 "$DATA_DIR/sao-luu"
if [[ -f "$DATA_DIR/sotay.sqlite" ]]; then
  dest="$DATA_DIR/sao-luu/truoc-cap-nhat-$(date +%Y%m%d-%H%M%S).sqlite"
  sudo -u sotay node -e '
    const Database = require(process.argv[3] + "/node_modules/better-sqlite3");
    new Database(process.argv[1], { readonly: true }).backup(process.argv[2]).then(() => process.exit(0));
  ' "$DATA_DIR/sotay.sqlite" "$dest" "$APP_DIR"
  echo "    $dest"
fi

echo "==> Lấy mã mới"
sudo -u sotay git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
sudo -u sotay git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
cd "$APP_DIR"
# better-sqlite3 đã kèm sẵn bản dựng cho Linux/Windows; --ignore-scripts để npm không tự biên dịch lại (VPS thường không có make, g++).
sudo -u sotay npm ci --omit=dev --ignore-scripts --no-audit --no-fund

echo "==> Khởi động lại"
systemctl restart so-tay
sleep 2
if curl -fsS "http://127.0.0.1:$PORT/api/state" >/dev/null; then
  echo "Đã cập nhật xong: $(sudo -u sotay git -C "$APP_DIR" log -1 --format='%h %s')"
else
  echo "Ứng dụng chưa chạy lại. Xem lỗi: journalctl -u so-tay -n 50"
  exit 1
fi
