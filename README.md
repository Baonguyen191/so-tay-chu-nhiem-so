# Sổ tay Chủ nhiệm số

Ứng dụng giúp giáo viên chủ nhiệm tiểu học **điểm danh, ghi nhận xét, tặng ngôi sao và liên lạc phụ huynh** ngay trên điện thoại hoặc máy tính. Nhiều giáo viên dùng chung một hệ thống. Mỗi người chỉ thấy lớp mình chủ nhiệm, còn Ban giám hiệu quản lý chung.

Sản phẩm dự thi "Trường học số – đổi mới sáng tạo" của xã Tân Minh.

## Hai phiên bản

| | **Bản giáo viên** (dùng ngay) | **Bản nhà trường** (có máy chủ) |
|---|---|---|
| Địa chỉ | **https://baonguyen191.github.io/so-tay-chu-nhiem-so/** | Tự chạy trên máy của trường (mục 3 trở đi) |
| Tài khoản | Không cần. Mở link là dùng. | Đăng nhập; Ban giám hiệu tạo tài khoản cho giáo viên |
| Dữ liệu nằm ở đâu | Trong trình duyệt của thiết bị đang dùng. Không gửi đi đâu. | Trong file CSDL trên máy chủ của trường |
| Dùng trên nhiều máy | Tải file sao lưu, rồi khôi phục trên máy kia (mục **Lớp → Sao lưu**) | Tự đồng bộ: đăng nhập ở máy nào cũng thấy |

**Lưu ý với bản giáo viên:** xóa lịch sử duyệt web, dùng chế độ ẩn danh, hoặc mất máy đều làm **mất dữ liệu**. Hãy bấm **Lớp → Tải file sao lưu** mỗi tuần. Trên iPhone, nên mở bằng Safari rồi chọn **Thêm vào MH chính**.

Mã nguồn bản giáo viên nằm ở thư mục `pages/`. Mỗi lần đẩy mã lên nhánh `main`, GitHub Actions tự kiểm thử, ghép bản (`npm run build:pages`) và đưa lên GitHub Pages.

## Mục lục

1. [Ứng dụng làm được gì](#1-ứng-dụng-làm-được-gì)
2. [Cài Node.js](#2-cài-nodejs-chỉ-làm-một-lần)
3. [Chạy ứng dụng trên máy tính của trường](#3-chạy-ứng-dụng-trên-máy-tính-của-trường)
4. [Lần đầu sử dụng: tạo tài khoản quản trị, giáo viên, lớp](#4-lần-đầu-sử-dụng)
5. [Nhập danh sách học sinh](#5-nhập-danh-sách-học-sinh)
6. [Sao lưu và khôi phục dữ liệu](#6-sao-lưu-và-khôi-phục-dữ-liệu)
7. [Quên mật khẩu](#7-quên-mật-khẩu)
8. [Dữ liệu demo khi đi thi](#8-dữ-liệu-demo-khi-đi-thi)
9. [Đưa lên mạng để dùng bằng điện thoại ở mọi nơi](#9-đưa-lên-mạng-để-dùng-bằng-điện-thoại-ở-mọi-nơi)
10. [Bảo mật và dữ liệu cá nhân](#10-bảo-mật-và-dữ-liệu-cá-nhân)
11. [Dành cho người phụ trách kỹ thuật](#11-dành-cho-người-phụ-trách-kỹ-thuật)

---

## 1. Ứng dụng làm được gì

**Giáo viên chủ nhiệm** có 5 màn hình:

| Màn hình | Công việc |
|---|---|
| **Hôm nay** | Sĩ số, số em có mặt/vắng, tỉ lệ chuyên cần tháng. Mục "Cần quan tâm" tự liệt kê các em vắng nhiều hoặc có nhận xét "Chưa hoàn thành". Mục "Lưu ý sức khỏe". Danh sách học sinh, có nút sao chép bảng chuyên cần sang Excel. |
| **Điểm danh** | Chạm vào tên để đổi: Có mặt → Vắng có phép → Vắng không phép. Mỗi lần chạm được lưu ngay. |
| **Nhận xét** | Ghi nhận xét theo 3 mức của Thông tư 27/2020/TT-BGDĐT: Hoàn thành tốt / Hoàn thành / Chưa hoàn thành. Có câu gợi ý sẵn. |
| **Ngôi sao** | Tặng hoặc trừ sao theo tuần, kèm bảng xếp hạng 3 em đứng đầu. |
| **Phụ huynh** | Mẫu tin nhắn tự điền tên học sinh, tên lớp, tên giáo viên: báo vắng, khen ngợi, nhắc nhở, tổng kết tuần, thông báo chung. Sao chép rồi dán vào Zalo hoặc SMS. |

**Ban giám hiệu (Quản trị)** có thêm mục **Quản trị**:
- tạo, sửa, khóa tài khoản giáo viên và đặt lại mật khẩu;
- tạo lớp (tên lớp, khối, năm học, tên trường) và phân công giáo viên chủ nhiệm;
- sao lưu và khôi phục toàn bộ dữ liệu.

Một giáo viên có thể chủ nhiệm nhiều lớp qua các năm. Ô chọn lớp ở đầu trang dùng để chuyển giữa các lớp.

---

## 2. Cài Node.js (chỉ làm một lần)

Node.js là phần mềm miễn phí giúp máy tính chạy được ứng dụng này.

1. Vào trang **https://nodejs.org**.
2. Bấm nút tải bản **LTS** (bản ổn định, số phiên bản từ **22** trở lên).
3. Mở file vừa tải và bấm **Next** liên tục cho đến **Install**, rồi **Finish**. Giữ nguyên các lựa chọn mặc định.
4. Kiểm tra: bấm phím Windows, gõ `cmd`, nhấn Enter. Trong cửa sổ đen, gõ `node -v` rồi nhấn Enter. Nếu hiện dòng như `v22.x.x` hoặc `v24.x.x` là đã cài xong.

---

## 3. Chạy ứng dụng trên máy tính của trường

### Cách đơn giản nhất (Windows)

1. Chép cả thư mục ứng dụng vào máy, ví dụ `C:\SoTayChuNhiem`.
   > **Lưu ý:** không nên đặt thư mục trong **OneDrive**, **Google Drive** hay **Dropbox**. Các phần mềm đồng bộ này có thể làm hỏng file dữ liệu khi ứng dụng đang ghi.
2. Bấm đúp vào file **`Chay-So-tay.bat`**.
   - Lần đầu, máy tự cài các thành phần cần thiết. Việc này cần mạng Internet và mất khoảng 1–2 phút.
   - Khi thấy dòng **"Sổ tay Chủ nhiệm số đang chạy"** là xong.
3. Mở trình duyệt (Chrome, Edge, Cốc Cốc…) và vào địa chỉ **http://localhost:3000**.
4. **Giữ cửa sổ đen mở** trong suốt thời gian sử dụng. Đóng cửa sổ là tắt ứng dụng.

### Dùng bằng điện thoại trong trường (cùng mạng Wi-Fi)

Cửa sổ đen sẽ in ra địa chỉ dạng:

```
Điện thoại cùng Wi-Fi: http://192.168.1.25:3000
```

Trên điện thoại đang nối **cùng Wi-Fi** với máy tính, mở trình duyệt và gõ đúng địa chỉ đó.

- Nếu Windows hỏi về **Tường lửa (Firewall)**, chọn **Cho phép** (Allow) với mạng **Riêng tư** (Private).
- Máy tính chạy ứng dụng phải **luôn bật** thì điện thoại mới dùng được.
- Máy có thể in ra nhiều địa chỉ. Hãy thử từng địa chỉ. Địa chỉ đúng thường bắt đầu bằng `192.168.`.

### Cách chạy bằng lệnh (cho người quen dùng máy tính)

```
cd C:\SoTayChuNhiem
npm install
npm start
```

---

## 4. Lần đầu sử dụng

### Bước 1. Tạo tài khoản quản trị

Lần đầu mở ứng dụng, màn hình **"Tạo tài khoản quản trị"** sẽ hiện ra. Tài khoản này dành cho Ban giám hiệu.

- Điền **Họ và tên**, chọn **Danh xưng** (Cô / Thầy).
- **Tên đăng nhập**: chữ không dấu, viết liền, ví dụ `hieutruong`.
- **Mật khẩu**: ít nhất 8 ký tự. Hãy ghi lại và cất ở nơi an toàn.

Màn hình này chỉ xuất hiện **một lần**. Sau khi đã có tài khoản quản trị, ứng dụng luôn hiện màn hình Đăng nhập.

### Bước 2. Tạo tài khoản cho giáo viên

Vào **Quản trị → Giáo viên → Thêm tài khoản**.

- Ứng dụng tự tạo sẵn một mật khẩu ngẫu nhiên. Sau khi tạo, bấm **Sao chép** để gửi thông tin đăng nhập cho giáo viên.
- Giáo viên nên tự đổi mật khẩu sau lần đăng nhập đầu tiên: **Tài khoản → Đổi mật khẩu**.

### Bước 3. Tạo lớp và phân công chủ nhiệm

Vào **Quản trị → Lớp học → Tạo lớp**. Điền:
- tên lớp (ví dụ `3A`);
- khối (tự chọn theo tên lớp);
- năm học (ví dụ `2026–2027`);
- tên trường;
- giáo viên chủ nhiệm.

Sang năm học mới, hãy **tạo lớp mới**. Dữ liệu năm cũ vẫn được giữ để tra cứu.

### Bước 4. Giáo viên đăng nhập và nhập học sinh

Xem mục [5. Nhập danh sách học sinh](#5-nhập-danh-sách-học-sinh).

> **Về khóa tài khoản:** nếu nhập sai mật khẩu **5 lần liên tiếp**, tài khoản bị **khóa tạm 5 phút** để chống dò mật khẩu. Sau 5 phút có thể thử lại.

---

## 5. Nhập danh sách học sinh

Ở màn hình **Hôm nay**, bấm **Nhập danh sách**. Có hai cách.

### Cách 1. Dán từ Excel (nhanh nhất)

1. Trong Excel, bôi đen các ô cần nhập (có thể kèm dòng tiêu đề) rồi nhấn **Ctrl + C**.
2. Trong ứng dụng, bấm vào ô trống rồi nhấn **Ctrl + V**.
3. Bấm **Xem trước**.

### Cách 2. Tải file lên

1. Tải **file mẫu** ngay trong hộp thoại nhập danh sách (Excel .xlsx hoặc .csv).
2. Điền mỗi em một dòng, rồi lưu file.
3. Chọn **Tải file lên**, chọn file, rồi bấm **Xem trước**.

### Thứ tự cột

| Họ và tên | Ngày sinh | Giới tính | Họ tên phụ huynh | Số điện thoại | Ghi chú sức khỏe |
|---|---|---|---|---|---|
| Nguyễn Minh Anh | 05/09/2018 | Nữ | Nguyễn Văn Hùng | 0912345678 | Dị ứng hải sản |

- Chỉ **Họ và tên** là bắt buộc. Các cột khác có thể bổ sung sau.
- Ngày sinh ghi theo dạng **ngày/tháng/năm**.
- Nếu Excel làm mất số 0 ở đầu số điện thoại, ứng dụng tự thêm lại.

### Xem trước và lưu

Bảng xem trước **tô đỏ các dòng lỗi** và ghi rõ lý do, ví dụ thiếu tên, ngày sinh không có thật (31/02), số điện thoại sai, hoặc trùng với học sinh đã có. Dòng lỗi **không được lưu**. Thầy/cô có thể quay lại sửa, hoặc lưu các dòng đúng trước rồi nhập bổ sung sau.

Muốn thêm, sửa hoặc xóa từng em: bấm vào **tên học sinh** để mở hồ sơ. Ứng dụng luôn hỏi lại trước khi xóa. Danh sách tự sắp xếp theo **tên, rồi đến họ**, đúng thứ tự chữ cái tiếng Việt.

---

## 6. Sao lưu và khôi phục dữ liệu

> Toàn bộ dữ liệu nằm trong **một file duy nhất**: `data\sotay.sqlite` (trong thư mục ứng dụng). Mất file này là mất dữ liệu. Hãy sao lưu đều đặn.

### Sao lưu (nên làm mỗi tuần)

1. Đăng nhập bằng tài khoản quản trị.
2. Vào **Quản trị → Sao lưu → Tải file sao lưu**.
3. Máy tải về file dạng `sotay-sao-luu-20261007-153000.sqlite`.
4. Cất file vào **USB**, ổ mạng, hoặc Google Drive của trường. Nên giữ vài bản gần nhất.

> File sao lưu chứa thông tin cá nhân của học sinh. **Không** gửi file qua nhóm chat và không đăng công khai.

Cách khác: **tắt ứng dụng** (đóng cửa sổ đen), rồi chép cả thư mục `data` sang nơi khác.

### Khôi phục

1. Vào **Quản trị → Sao lưu → Khôi phục từ file sao lưu**, rồi chọn file.
2. Gõ chữ **KHÔI PHỤC** để xác nhận.
3. Toàn bộ dữ liệu hiện tại được thay bằng dữ liệu trong file. Trước khi thay, ứng dụng **tự giữ lại một bản** dữ liệu cũ trong `data\sao-luu\`, phòng khi chọn nhầm file.
4. Mọi người phải đăng nhập lại.

---

## 7. Quên mật khẩu

- **Giáo viên quên mật khẩu:** nhờ Ban giám hiệu vào **Quản trị → Giáo viên → Đặt lại mật khẩu**.
- **Quản trị quên mật khẩu:**
  - Nếu trường có từ 2 tài khoản quản trị trở lên, người còn lại đặt lại giúp.
  - Nếu không, người phụ trách máy chủ mở cửa sổ lệnh trong thư mục ứng dụng và gõ:

    ```
    npm run dat-lai-mat-khau -- hieutruong MatKhauMoi123
    ```

    Thay `hieutruong` bằng tên đăng nhập, `MatKhauMoi123` bằng mật khẩu mới. Lệnh này cũng mở khóa tài khoản.

> Nên tạo ít nhất **2 tài khoản quản trị** (ví dụ Hiệu trưởng và Phó hiệu trưởng) để không bị kẹt khi một người quên mật khẩu.

---

## 8. Dữ liệu demo khi đi thi

Bản chính thức **không có sẵn học sinh mẫu**. Khi cần trình diễn, chạy:

```
npm run demo
```

Lệnh này tạo lớp 3A với 20 học sinh mẫu, khoảng một tháng điểm danh, nhận xét và ngôi sao, rồi chạy ứng dụng.

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Quản trị | `admin` | `demo2026` |
| Giáo viên (Cô Nguyễn Thị Hạnh, lớp 3A) | `cohanh` | `demo2026` |

- Dữ liệu demo nằm trong **file riêng** `data\demo.sqlite`. **Dữ liệu thật không bị ảnh hưởng.**
- Mỗi lần chạy `npm run demo`, dữ liệu demo được tạo lại từ đầu.
- Muốn quay về dữ liệu thật, tắt cửa sổ demo rồi chạy lại bằng `Chay-So-tay.bat` (hoặc `npm start`).

---

## 9. Đưa lên mạng để dùng bằng điện thoại ở mọi nơi

Ở mục 3, điện thoại chỉ dùng được khi ở **trong trường, cùng Wi-Fi**. Muốn giáo viên dùng ở nhà bằng 4G, cần đưa ứng dụng lên mạng. Dưới đây là 3 cách, từ dễ đến chuyên nghiệp.

> **Bắt buộc khi đưa lên mạng:** dùng địa chỉ **https://**, có biểu tượng ổ khóa. Các cách dưới đây đều có sẵn HTTPS.

### Cách A. Cloudflare Tunnel từ máy tính của trường (miễn phí)

Ứng dụng vẫn chạy trên máy tính ở trường. Cloudflare tạo một đường dẫn https công khai trỏ về máy đó, nên dữ liệu vẫn nằm tại trường.

1. Tải chương trình `cloudflared` cho Windows tại trang hướng dẫn của Cloudflare (tìm "cloudflared download").
2. Trong lúc ứng dụng đang chạy, mở một cửa sổ lệnh khác và gõ:

   ```
   cloudflared tunnel --url http://localhost:3000
   ```

3. Cửa sổ sẽ in ra một địa chỉ dạng `https://ten-ngau-nhien.trycloudflare.com`. Gửi địa chỉ này cho giáo viên.

- Ưu điểm: miễn phí, không cần thuê máy chủ.
- Nhược điểm: máy tính ở trường phải **luôn bật**. Với cách nhanh ở trên, địa chỉ **đổi mỗi lần chạy lại**. Muốn địa chỉ cố định, cần một tên miền riêng (khoảng vài trăm nghìn đồng/năm) và cấu hình "named tunnel" theo hướng dẫn của Cloudflare.

### Cách B. Thuê máy chủ ảo (VPS) giá rẻ (khuyên dùng khi dùng lâu dài)

Thuê một máy chủ ảo nhỏ (1 CPU, 1 GB RAM là đủ) của một nhà cung cấp tại Việt Nam, giá tham khảo khoảng **100.000–200.000 đồng/tháng**. Dữ liệu học sinh khi đó được lưu trong nước.

Người phụ trách kỹ thuật làm các bước sau:
1. Cài Node.js 22+ lên máy chủ và chép thư mục ứng dụng lên.
2. Chạy `npm install --omit=dev`.
3. Cho ứng dụng tự khởi động cùng máy chủ, ví dụ bằng `pm2` hoặc `systemd`, với biến môi trường `TRUST_PROXY=1`.
4. Cài **Caddy** làm cổng HTTPS. File `Caddyfile` chỉ cần 3 dòng:

   ```
   sotay.tentruong.edu.vn {
       reverse_proxy localhost:3000
   }
   ```

   Caddy tự xin chứng chỉ HTTPS miễn phí.
5. Hằng tuần vẫn tải file sao lưu về như mục 6.

### Cách C. Dịch vụ đám mây có sẵn (Render, Railway, Fly.io…)

Dùng được, nhưng cần lưu ý: ứng dụng lưu dữ liệu vào **một file**. Gói miễn phí của nhiều dịch vụ **xóa sạch file khi khởi động lại**, nên sẽ **mất dữ liệu**. Bắt buộc phải mua thêm **ổ đĩa lưu trữ bền** (persistent disk/volume). Sau đó:
- đặt biến môi trường `DATA_DIR` trỏ vào ổ đĩa đó;
- đặt `TRUST_PROXY=1`.

Chi phí tham khảo khoảng vài USD/tháng. Vì vậy cách này thường không rẻ hơn VPS ở Cách B.

---

## 10. Bảo mật và dữ liệu cá nhân

Những gì ứng dụng đã làm:
- **Mật khẩu** được băm bằng bcrypt. Không ai đọc được mật khẩu gốc, kể cả quản trị.
- **Phiên đăng nhập** lưu trong cookie httpOnly: mã độc trên trang không đọc được cookie này. Phiên hết hạn sau 12 giờ.
- **Khóa tạm 5 phút** sau 5 lần nhập sai mật khẩu.
- **Phân quyền ở máy chủ:** giáo viên chỉ đọc và sửa được lớp mình chủ nhiệm. Sửa đường dẫn trên trình duyệt cũng không xem được lớp khác.
- **Chống XSS:** mọi dữ liệu hiển thị đều được mã hóa, nên một đoạn mã gõ vào ô ghi chú chỉ hiện ra như chữ thường.
- **Chống CSRF:** mọi thao tác ghi phải kèm mã bí mật của phiên và đến từ chính trang của ứng dụng.
- Mọi dữ liệu nhập vào đều được kiểm tra: tên, ngày sinh, số điện thoại, năm học…

Những việc nhà trường cần làm:
- Chỉ lưu thông tin **cần cho công tác chủ nhiệm**. Ứng dụng **không có ô** nhập số định danh cá nhân hay số căn cước, và không nên ghi các số này vào ô ghi chú.
- Mỗi giáo viên dùng tài khoản riêng, không dùng chung mật khẩu.
- Khi giáo viên chuyển trường hoặc nghỉ, vào Quản trị để **khóa** tài khoản.
- Cất file sao lưu cẩn thận như hồ sơ giấy.
- Tuân thủ các quy định hiện hành về bảo vệ dữ liệu cá nhân, đặc biệt là dữ liệu của trẻ em.

---

## 11. Dành cho người phụ trách kỹ thuật

### Công nghệ

- Node.js 22+, Express 5, SQLite (better-sqlite3), bcryptjs, helmet, exceljs.
- Giao diện viết bằng HTML/CSS/JavaScript thuần (ES modules), không cần bước build.

### Lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm start` | Chạy ứng dụng với dữ liệu thật (`data/sotay.sqlite`) |
| `npm test` | Chạy kiểm thử tự động: đăng nhập, phân quyền theo lớp, nhập hàng loạt, tỉ lệ chuyên cần, sao lưu |
| `npm run demo` | Nạp dữ liệu demo vào `data/demo.sqlite` rồi chạy |
| `npm run demo -- --chi-nap` | Chỉ nạp dữ liệu demo, không chạy |
| `npm run dat-lai-mat-khau -- <tên> <mật khẩu>` | Đặt lại mật khẩu và mở khóa một tài khoản |

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng chạy ứng dụng |
| `HOST` | `0.0.0.0` | Địa chỉ lắng nghe (mặc định cho phép máy khác trong mạng truy cập) |
| `DATA_DIR` | `data` | Thư mục chứa dữ liệu |
| `DB_FILE` | `<DATA_DIR>/sotay.sqlite` | Đường dẫn file cơ sở dữ liệu |
| `TRUST_PROXY` | (tắt) | Đặt `1` khi chạy sau Caddy/Nginx/Cloudflare/Render… để nhận đúng HTTPS và địa chỉ IP người dùng. Nếu không đặt, giới hạn đăng nhập sai theo IP sẽ tính chung cho mọi người. |

### Cấu trúc thư mục

```
server/            máy chủ
  index.js         khởi động
  app.js           cấu hình Express, helmet (CSP), gắn các API
  auth.js          mật khẩu, phiên, CSRF, kiểm tra quyền theo lớp
  db.js            lược đồ SQLite (PRAGMA user_version để nâng cấp)
  routes/          auth, admin, classes, students, records, backup
  lib/             đọc file nhập (import.js), tạo file mẫu (template.js)
public/            giao diện
  index.html, css/app.css
  js/app.js        khởi động, đăng nhập, khung, chọn lớp
  js/views/        home, att, cmt, star, msg, student, import, admin
  js/shared/       dùng chung với máy chủ: validate, vnsort, stats, constants
scripts/           demo.js, dat-lai-mat-khau.js
tests/             kiểm thử (node:test + supertest)
so-tay-chu-nhiem-so.html   bản demo gốc (giữ để đối chiếu)
```

### Các bảng dữ liệu

`users`, `sessions`, `classes`, `students`, `attendance_days` (ngày lớp đã điểm danh), `absences` (chỉ lưu học sinh vắng: P = có phép, K = không phép), `comments`, `stars`.

**Tỉ lệ chuyên cần tháng** = tổng lượt có mặt ÷ (số buổi đã điểm danh × sĩ số), chỉ tính các ngày đã điểm danh từ đầu tháng đến ngày đang xem.
