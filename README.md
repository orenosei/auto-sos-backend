# RescueSOS Backend

RescueSOS là nền tảng kết nối người gặp sự cố phương tiện với các đơn vị cứu hộ gần nhất. Backend cung cấp REST API để quản lý người dùng, công ty cứu hộ, dịch vụ, phương tiện, yêu cầu cứu hộ, tin nhắn, hình ảnh, đánh giá, thông báo và nội dung cộng đồng.

## Tính năng chính

- **Người dùng:** đăng ký, đăng nhập, quản lý hồ sơ, phương tiện, gửi và theo dõi yêu cầu cứu hộ.
- **Công ty cứu hộ:** đăng ký, đăng nhập, quản lý hồ sơ, dịch vụ, tiếp nhận và cập nhật trạng thái yêu cầu.
- **Yêu cầu cứu hộ:** tạo yêu cầu theo vị trí, gắn dịch vụ, hình ảnh, tin nhắn, đánh giá sau khi hoàn thành.
- **Cộng đồng:** đăng bài, bình luận, thích nội dung, báo cáo và kiểm duyệt trạng thái.
- **Thông báo:** lưu và đánh dấu đã đọc các thông báo trong hệ thống.
- **Tích hợp ngoài:** PostgreSQL/PostGIS hoặc Neon Serverless cho dữ liệu, Cloudinary cho chữ ký upload ảnh.

## Công nghệ sử dụng

- Node.js, Express 5.
- PostgreSQL, PostGIS, Neon Serverless.
- Vitest, Supertest cho kiểm thử.
- Cloudinary signed upload.
- Nodemon cho môi trường phát triển.

## Cấu trúc thư mục

```text
auto-sos-backend/
  src/
    app.js                 # Cấu hình Express app và route chính
    server.js              # Điểm chạy server
    config/                # Kết nối DB, script khởi tạo DB
    controllers/           # Xử lý request/response
    middlewares/           # Logger, not found, error handler
    repositories/          # Truy vấn database
    routes/                # Khai báo REST API routes
    services/              # Logic nghiệp vụ dùng chung
    utils/                 # Hàm tiện ích, validator
  tests/                   # Unit, API và integration tests
  package.json
```

## Yêu cầu cài đặt

- Node.js 18 trở lên.
- npm.
- PostgreSQL có bật PostGIS hoặc database Neon.
- Tài khoản Cloudinary nếu dùng chức năng upload ảnh.

## Cài đặt và chạy backend

### 1. Cài dependency

Từ thư mục gốc repository:

```bash
cd auto-sos-backend
npm install
```

### 2. Tạo cơ sở dữ liệu

Tạo database PostgreSQL/Neon, sau đó chạy file khởi tạo:

```bash
psql "<DATABASE_URL>" -f src/config/db_init.sql
```

Nếu dùng công cụ quản trị như pgAdmin, DBeaver hoặc Neon SQL Editor, có thể mở nội dung file `src/config/db_init.sql` và chạy trực tiếp.

### 3. Cấu hình biến môi trường

Tạo file `.env` trong thư mục `auto-sos-backend`:

```env
PORT=5001

# Cách 1: dùng connection string, khuyến nghị khi dùng Neon
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Cách 2: dùng từng biến riêng nếu không dùng DATABASE_URL
# PGUSER=
# PGPASSWORD=
# PGHOST=
# PGDATABASE=

# Dùng cho API tạo chữ ký upload Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Mã dùng để mở trang /admin
ADMIN_ACCESS_CODE=abc123

# Chỉ cần khi chạy integration test
# TEST_DATABASE_URL=postgresql://user:password@host/test_database?sslmode=require
```

Backend ưu tiên `DATABASE_URL`. Nếu không có `DATABASE_URL`, hệ thống sẽ ghép chuỗi kết nối từ `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGDATABASE`.

Khi nâng cấp cơ sở dữ liệu đã có sẵn, chạy thêm migration trạng thái khóa công ty:

```bash
psql "<DATABASE_URL>" -f src/config/migrate_20260621_company_active.sql
```

### 4. Chạy server

Chạy ở chế độ phát triển:

```bash
npm run dev
```

Chạy ở chế độ thường:

```bash
npm start
```

Mặc định server chạy tại:

```text
http://localhost:5001
```

Nếu đổi `PORT` trong `.env`, địa chỉ backend sẽ thay đổi theo port đó.

## Kết nối với frontend

Frontend nằm ở thư mục `auto-sos-frontend`. Khi phát triển toàn bộ hệ thống, mở thêm một terminal khác:

```bash
cd auto-sos-frontend
npm install
npm run dev
```

Frontend Vite thường chạy tại `http://localhost:5173`. Các request API cần trỏ về backend tại `http://localhost:5001` hoặc port đã cấu hình trong `.env`.

## Hướng dẫn sử dụng API

Base URL khi chạy local:

```text
http://localhost:5001/api
```

Các nhóm endpoint chính:

| Nhóm | Endpoint gốc | Chức năng |
| --- | --- | --- |
| Xác thực | `/api/auth` | Đăng ký/đăng nhập người dùng và công ty |
| Người dùng | `/api/users` | CRUD người dùng |
| Công ty | `/api/companies` | CRUD công ty, tìm công ty gần vị trí, dịch vụ, đánh giá |
| Dịch vụ | `/api/services` | Lấy danh sách dịch vụ |
| Phương tiện | `/api/vehicles` | CRUD phương tiện |
| Yêu cầu cứu hộ | `/api/requests` | CRUD yêu cầu, dịch vụ kèm theo, ảnh, tin nhắn, đánh giá |
| Thông báo | `/api/notifications` | Lấy thông báo, đánh dấu đã đọc |
| Cộng đồng | `/api/community` | Bài viết, bình luận, like, báo cáo, kiểm duyệt |

Ví dụ đăng ký người dùng:

```bash
curl -X POST http://localhost:5001/api/auth/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "user_name": "nguyenvana",
    "full_name": "Nguyen Van A",
    "user_email": "a@example.com",
    "user_phone": "0900000000",
    "password": "123456"
  }'
```

Ví dụ đăng nhập người dùng:

```bash
curl -X POST http://localhost:5001/api/auth/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "nguyenvana",
    "password": "123456"
  }'
```

Ví dụ lấy danh sách công ty gần một vị trí:

```bash
curl "http://localhost:5001/api/companies/nearby?latitude=21.0278&longitude=105.8342&radiusKm=10"
```

Ví dụ tạo chữ ký upload Cloudinary:

```bash
curl -X POST http://localhost:5001/api/requests/cloudinary/signature \
  -H "Content-Type: application/json" \
  -d '{ "folder": "rescuesos/requests" }'
```

Các folder Cloudinary được backend chấp nhận:

- `rescuesos/requests`
- `rescuesos/community`
- `rescuesos/avatars`
- `rescuesos/company-documents`

## Kiểm thử

Chạy unit test:

```bash
npm test
```

Chạy API route test:

```bash
npm run test:api
```

Chạy integration test với database thật:

```bash
npm run test:integration
```

Integration test chỉ chạy khi có `TEST_DATABASE_URL` trong `.env`. Nếu không có biến này, test integration sẽ được bỏ qua.

Chạy coverage:

```bash
npm run test:coverage
```

Báo cáo chi tiết về test suite nằm tại `tests/README.md`.

## Lỗi thường gặp

### Missing database connection configuration

Backend chưa tìm thấy cấu hình database. Kiểm tra lại `.env` và đảm bảo có một trong hai nhóm sau:

- `DATABASE_URL`
- hoặc đủ `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGDATABASE`

### Missing Cloudinary configuration

API tạo chữ ký upload ảnh cần đủ:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Port đã được sử dụng

Đổi `PORT` trong `.env`, ví dụ:

```env
PORT=5002
```

Sau đó chạy lại server.

## Thành viên nhóm thực hiện dự án

| Họ và tên | Mã sinh viên |
| --- | --- |
| Trịnh Minh Thành | 20235834 |
| Lê Duy Vũ | 20235878 |
| Đào Thái Hoàng | 20235720 |
| Trần Thu Phương | 20235811 |
| Nguyễn Trường Sơn | 20230097 |
