# RescueSOS

RescueSOS là nền tảng kết nối người gặp sự cố phương tiện với các đơn vị cứu hộ gần nhất. Hệ thống hỗ trợ gửi yêu cầu cứu hộ theo vị trí, theo dõi tiến trình xử lý và quản lý hoạt động của người dùng, công ty cứu hộ, quản trị viên trên cùng một nền tảng.

## Tính năng chính

- **Người dùng:** tìm dịch vụ, gửi và theo dõi yêu cầu cứu hộ, trao đổi với công ty, quản lý hồ sơ và tham gia cộng đồng.
- **Công ty cứu hộ:** tiếp nhận yêu cầu, cập nhật trạng thái xử lý, quản lý dịch vụ, phương tiện và hồ sơ công ty.
- **Quản trị viên:** quản lý người dùng, công ty, yêu cầu cứu hộ, nội dung cộng đồng và theo dõi thống kê hệ thống.
- Tích hợp bản đồ, định vị GPS, tải ảnh/tài liệu và thông báo.

## Công nghệ sử dụng

- **Frontend:** React, Vite, Tailwind CSS, React Router, Leaflet, Recharts.
- **Backend:** Node.js, Express.
- **Cơ sở dữ liệu:** PostgreSQL, PostGIS, Neon Serverless.
- **Lưu trữ tệp:** Cloudinary.

## Cài đặt và chạy dự án

### 1. Yêu cầu

- Node.js và npm.
- PostgreSQL có hỗ trợ PostGIS hoặc cơ sở dữ liệu Neon.
- Tài khoản Cloudinary.

### 2. Khởi tạo cơ sở dữ liệu

Chạy tệp `RescueSOS-BE/src/config/db_init.sql` trên cơ sở dữ liệu PostgreSQL.

### 3. Cấu hình backend

Tạo tệp `RescueSOS-BE/.env`:

```env
PGUSER=
PGPASSWORD=
PGHOST=
PGDATABASE=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
PORT=5001
```

Có thể sử dụng `DATABASE_URL` thay cho nhóm biến kết nối PostgreSQL.

### 4. Chạy ứng dụng

Mở hai terminal và chạy:

```bash
# Backend
cd RescueSOS-BE
npm install
npm run dev
```

```bash
# Frontend
cd RescueSOS-FE
npm install
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173` và chuyển tiếp các yêu cầu `/api` tới backend tại `http://localhost:5001`.

## Thành viên nhóm thực hiện dự án

| Họ và tên | Mã sinh viên |
|---|---|
| Trịnh Minh Thành | 20235834 |
| Lê Duy Vũ | 20235878 |
| Đào Thái Hoàng | 20235720 |
| Trần Thu Phương | 20235811 |
| Nguyễn Trường Sơn | 20230097 |

