# Báo Cáo Kiểm Thử Backend

Tài liệu này mô tả toàn bộ bộ kiểm thử backend trong thư mục `tests/`: mục tiêu,
phạm vi, cách chạy, kết quả hiện tại, coverage và các lưu ý khi chạy kiểm thử
với database thật.

## 1. Tổng Quan

Backend hiện có 3 lớp kiểm thử chính:

| Nhóm test | Thư mục | Mục đích | Lệnh chạy |
| --- | --- | --- | --- |
| Unit test | `tests/unit` | Kiểm tra controller, middleware, utils bằng mock repository/service | `npm test` |
| API route test | `tests/api` | Gọi route Express thật bằng `supertest`, mock tầng DB/repository | `npm run test:api` |
| Repository integration test | `tests/integration` | Chạy repository với database Neon/Postgres thật | `npm run test:integration` |

Thống kê hiện tại:

| Suite | Số file | Số test | Trạng thái gần nhất |
| --- | ---: | ---: | --- |
| Unit | 21 | 100 | Passed |
| API route | 1 | 13 | Passed |
| DB integration | 1 | 5 | Passed |
| Coverage suite | 22 | 113 | Passed |

Coverage gần nhất:

| Chỉ số | Giá trị |
| --- | ---: |
| Statements/Lines | 84.83% |
| Branches | 66.15% |
| Functions | 100% |

Báo cáo HTML coverage được tạo tại:

```bash
coverage/index.html
```

## 2. Cấu Trúc Thư Mục

```text
tests/
  README.md
  setup.js
  helpers/
    http.js
  unit/
    controllers/
    middlewares/
    services/
    utils/
  api/
    app.routes.test.js
  integration/
    repositories.integration.test.js
```

### `tests/setup.js`

File setup chung cho Vitest:

- Load biến môi trường từ `.env`.
- Đặt `NODE_ENV=test`.
- Đặt `DATABASE_URL` giả mặc định để unit/API test không bị `src/config/db.js`
  dừng chương trình khi import repository.

### `tests/helpers/http.js`

Helper tạo mock Express response:

- `res.status()`
- `res.json()`

Helper này được dùng trong unit test controller/middleware để giảm lặp code.

## 3. Các Lệnh Chạy Test

Chạy unit test:

```bash
npm test
```

Chạy API route test:

```bash
npm run test:api
```

Chạy DB integration test:

```bash
npm run test:integration
```

Chạy coverage cho unit + API route:

```bash
npm run test:coverage
```

Chạy coverage chỉ riêng unit test:

```bash
npm run test:coverage:unit
```

Chạy watch mode khi phát triển:

```bash
npm run test:watch
```

## 4. Unit Test

Unit test kiểm tra logic trong từng module riêng lẻ, không gọi database thật.
Repository và service được mock bằng `vi.mock`.

### 4.1 Utils

File:

- `tests/unit/utils/geo.test.js`
- `tests/unit/utils/validators.test.js`

Phạm vi:

- `toGeogPointText`
  - Trả `null` với input rỗng/null/undefined.
  - Chuyển `{ lat, lng }` thành `SRID=4326;POINT(lng lat)`.
  - Chuyển `{ latitude, longitude }`.
  - Thêm `SRID=4326;` cho chuỗi `POINT(...)`.
  - Giữ nguyên chuỗi đã có `SRID=`.
  - Từ chối object thiếu tọa độ hợp lệ.
- `toGeogText`
  - Kiểm tra alias của `toGeogPointText`.
- `isPositiveInteger`
  - Chấp nhận số nguyên dương.
  - Từ chối `0`, số âm, số thập phân, string.
- `isNonNegativeNumber`
  - Chấp nhận số hữu hạn >= 0.
  - Từ chối số âm, `NaN`, `Infinity`, string.

### 4.2 Middlewares

File:

- `tests/unit/middlewares/asyncHandler.test.js`
- `tests/unit/middlewares/errorHandler.test.js`
- `tests/unit/middlewares/notFoundHandler.test.js`
- `tests/unit/middlewares/requestLogger.test.js`

Phạm vi:

- `asyncHandler`
  - Lỗi async được đẩy vào `next(error)`.
  - Handler thành công không gọi `next`.
- `errorHandler`
  - Lỗi 4xx trả message thật.
  - Lỗi 500 ẩn message nội bộ bằng `Internal Server Error`.
  - Môi trường production không trả `details`.
  - Nếu `headersSent=true` thì chuyển tiếp sang `next(error)`.
- `notFoundHandler`
  - Trả status `404`.
  - Body gồm `error: "Route not found"` và `path`.
- `requestLogger`
  - Trong `NODE_ENV=test`, gọi `next()` ngay và không đăng ký listener.
  - Trong môi trường khác, đăng ký listener `finish`.
  - Khi response finish, log method, URL, status code và duration.

### 4.3 Controllers

File:

- `tests/unit/controllers/authController.test.js`
- `tests/unit/controllers/companiesController.test.js`
- `tests/unit/controllers/companyServicesController.test.js`
- `tests/unit/controllers/communityController.test.js`
- `tests/unit/controllers/notificationsController.test.js`
- `tests/unit/controllers/requestImagesController.test.js`
- `tests/unit/controllers/requestMessagesController.test.js`
- `tests/unit/controllers/requestServicesController.test.js`
- `tests/unit/controllers/requestsController.test.js`
- `tests/unit/controllers/reviewsController.test.js`
- `tests/unit/controllers/servicesController.test.js`
- `tests/unit/controllers/usersController.test.js`
- `tests/unit/controllers/vehiclesController.test.js`

#### Auth Controller

- Register user:
  - Thiếu trường bắt buộc -> `400`.
  - User đã tồn tại -> `409`.
  - Hash password và insert user thành công -> `201`.
- Login user:
  - Thiếu credentials -> `400`.
  - Identifier không tồn tại -> `401`.
  - User inactive -> `403`.
  - Login thành công -> `200`, không trả `password_hash`.
- Register company:
  - Thiếu/sai `absolute_address` -> `400`.
  - Tạo company thành công với `geogText`.
- Login company:
  - Sai password -> `401`.

#### Requests Controller

- `getRequests`
  - Thiếu cả `user_id` và `company_id` -> `400`.
  - Status không hợp lệ -> `400`.
  - User/company không tồn tại -> `404`.
  - Query thành công -> `200`.
- `createRequest`
  - Thiếu/sai `absolute_location` -> `400`.
  - Company không cung cấp service đã chọn -> `400`.
  - Tạo request thành công:
    - Insert request.
    - Upsert service line.
    - Insert status history.
    - Tạo notification cho company.
    - Tính `estimated_arrival` từ `eta_minutes`.
- `updateRequest`
  - Request không tồn tại -> `404`.
  - Vehicle không thuộc company -> `404`.
  - Đổi status -> insert history + notification user.
  - Status không đổi -> không insert history.
  - Sync vehicle status.
- `deleteRequest`
  - Request không tồn tại -> `404`.

#### Companies Controller

- Lấy danh sách companies.
- Detail company không tồn tại -> `404`.
- Validate create company.
- Tạo company với địa chỉ geog.
- Update/delete company không tồn tại -> `404`.
- Search nearby:
  - Thiếu query -> `400`.
  - Radius không hợp lệ -> `400`.
  - Gọi repository với `radiusMeters`.
- Batch ratings:
  - Parse ids hợp lệ.
  - Trả map rating theo company id.

#### Vehicles Controller

- List vehicles cần `company_id`.
- Company không tồn tại -> `404`.
- Validate create fields.
- Validate `vehicle_status`.
- Tạo vehicle với `geogText`.
- Duplicate `vehicle_license` -> `409`.
- Update/delete không thấy row -> `404`.

#### Company Services Controller

- List company services.
- Validate payload add/update.
- Add service cho company.
- Update service price.
- Delete company service.
- Company/service không tồn tại -> `404`.

#### Request Services Controller

- List request services.
- Validate `service_id`, `service_quantity`, `service_price`.
- Add/upsert request service.
- Update request service.
- Delete request service.
- Request/service/request-service không tồn tại -> `404`.

#### Request Messages Controller

- List messages.
- Validate `message_sender`, `message_content`.
- Tạo message.
- Mark seen với giá trị explicit.
- Default `is_seen=true` khi body không có `is_seen`.
- Message không tồn tại -> `404`.

#### Request Images Controller

- Cloudinary config thiếu -> `500`.
- Tạo Cloudinary signature đúng hash SHA1.
- List request images.
- Validate `image_url`.
- Add image.
- Delete image.
- Image không tồn tại -> `404`.

#### Reviews Controller

- Validate `review_rating`.
- Chỉ cho review khi request đã `completed`.
- Tạo review.
- Tạo notification cho company.
- Duplicate review -> `409`.
- Lấy reviews/rating của company.

#### Notifications Controller

- Validate `recipient_type`, `recipient_id`.
- Giới hạn `limit` tối đa `1000`.
- DB timeout trả data rỗng để UI không bị lỗi.
- Mark notification read.
- Notification không tồn tại -> `404`.

#### Community Controller

- Map payload post/comment.
- Detail post không tồn tại -> `404`.
- Validate create post.
- Chặn sensitive words.
- Tạo post với images và tags.
- Tạo comment.
- Toggle post/comment like.
- Tạo content report và notification cho admin.
- Validate moderation status.
- Update report/post/comment status.
- List reports.

#### Users/Services Controllers

- List users/services.
- User detail không tồn tại -> `404`.
- Validate create user.
- Create/update/delete user.
- Repository error -> `500` với services.

### 4.4 Services

File:

- `tests/unit/services/notificationService.test.js`
- `tests/unit/services/sensitiveWordService.test.js`

Phạm vi:

- `notificationService`
  - Bỏ qua khi thiếu field bắt buộc.
  - Insert notification khi payload hợp lệ.
  - Log và không throw khi insert notification lỗi.
  - Tạo notification cho toàn bộ admin active.
  - Log và không throw khi lấy danh sách admin lỗi.
  - Trả đúng title/message cho các request status được hỗ trợ.
  - Status không hỗ trợ trả `null`.
- `sensitiveWordService`
  - Bỏ qua dòng comment và dòng trống trong file cấu hình.
  - Tìm từ nhạy cảm không phân biệt hoa/thường.
  - Tìm trong nhiều phần nội dung truyền vào.
  - File không có từ nhạy cảm -> trả `[]`.
  - File thiếu (`ENOENT`) -> trả `[]`.
  - Lỗi đọc file bất thường -> rethrow.

## 5. API Route Test

File:

- `tests/api/app.routes.test.js`

API route test dùng `supertest` để gọi Express `app` thật. Tầng DB/repository
được mock, nên test tập trung vào:

- Route path có đúng không.
- Middleware JSON/body parser hoạt động.
- Router mounting trong `app.js` hoạt động.
- Controller nhận params/query/body đúng.
- Response HTTP status/body đúng.

Endpoint đã test:

| Endpoint | Method | Mục đích |
| --- | --- | --- |
| `/api/does-not-exist` | GET | App-level 404 JSON và tắt `x-powered-by` |
| `/api/auth/users/login` | POST | Login user qua route auth |
| `/api/services` | GET | Lấy danh sách services |
| `/api/vehicles` | POST | Tạo vehicle, normalize location |
| `/api/requests/:id/messages` | POST | Tạo message trong request |
| `/api/requests/cloudinary/signature` | POST | Tạo Cloudinary signature |
| `/api/companies/nearby` | GET | Search company gần vị trí |
| `/api/companies/ratings` | GET | Batch company ratings |
| `/api/companies/:id/services` | POST/PUT | Add/update company service |
| `/api/companies/:id/reviews` | GET | Lấy reviews của company |
| `/api/companies/:id/rating` | GET | Lấy rating summary |
| `/api/notifications` | GET | Lấy notifications |
| `/api/notifications/:id/read` | PUT | Mark notification read |
| `/api/requests/:id/services` | POST | Add request service |
| `/api/requests/:id/images` | POST | Add request image |
| `/api/requests/:id/review` | POST | Tạo review cho request |
| `/api/community/posts` | GET | List community posts |
| `/api/community/posts/:id/comments` | POST | Tạo comment |
| `/api/community/posts/:id/like` | POST | Toggle post like |
| `/api/community/reports` | POST | Tạo content report |
| `/api/community/posts/:id/status` | PUT | Update post status |

Lưu ý: `supertest` tạo listener nội bộ. Trong một số sandbox, lệnh này cần quyền
mở socket nội bộ. Trên máy local thông thường có thể chạy trực tiếp:

```bash
npm run test:api
```

## 6. Repository Integration Test

File:

- `tests/integration/repositories.integration.test.js`

Integration test kết nối database Neon/Postgres thật thông qua `TEST_DATABASE_URL`.
Test tạo dữ liệu với suffix ngẫu nhiên, sau đó cleanup ở `afterAll`.

Biến môi trường:

```bash
TEST_DATABASE_URL=postgresql://...
```

Biến này đang được đọc từ `.env`. Không commit `.env` lên repository.

Chạy:

```bash
npm run test:integration
```

### 6.1 Auth + Entity Repositories

Phạm vi:

- Insert registered user.
- Insert registered company.
- Tìm user tồn tại bằng username/phone/email.
- Tìm company tồn tại bằng name/phone.
- Lấy user auth row có `password_hash`.
- Kiểm tra `userExists`, `companyExists`.

### 6.2 Service + Company Service + Vehicle

Phạm vi:

- Insert service bằng SQL seed.
- Insert company service.
- `findAllServices`.
- `findCompanyServicePrice`.
- Insert vehicle.
- List vehicles by company.
- Update vehicle status/equipment/location.
- `vehicleExists`.
- `vehicleBelongsToCompany`.

### 6.3 Request + Message + Notification + Vehicle Status

Phạm vi:

- Insert request.
- Upsert request service line.
- Insert request status history.
- Find request by id.
- Find requests by user/status.
- `requestExists`.
- Insert message.
- List messages.
- Mark message seen.
- Insert notification.
- Find notifications.
- Mark notification read.
- Update request sang `accepted`.
- Sync vehicle status sang `busy`.
- Delete request.

### 6.4 Company Aggregate + Images + Reviews + Constraint

Phạm vi:

- Tạo request đã `completed`.
- Insert request image.
- List request images.
- Insert review.
- Find company reviews.
- Get company rating summary.
- `findCompanyById` gồm aggregate services/reviews.
- `findNearbyCompanies`.
- `findCompanyRatingsByIds`.
- Kiểm tra duplicate user constraint trả code `23505`.
- Delete request image.

### 6.5 Community Repository

Phạm vi:

- Insert post.
- Insert post image.
- Upsert tag.
- Link post-tag.
- Toggle post like.
- Count post likes.
- Insert comment.
- Toggle comment like.
- Count comment likes.
- Find posts với category/search/user id.
- Find published post by id.
- Find published comments by post id.
- Find comment payload.
- Insert content report.
- Find content reports.
- Update report status.
- Update post status.
- Update comment status.

## 7. Coverage

Coverage cấu hình trong `vitest.config.js`:

- Provider: `v8`
- Reporter:
  - `text`
  - `html`
  - `lcov`
- Output: `coverage/`
- Include: `src/**/*.js`
- Exclude:
  - `src/config/**`
  - `src/repositories/**`
  - `src/server.js`

Lý do exclude repositories trong coverage mặc định:

- Unit/API test mock repository.
- Repository được kiểm tra bằng DB integration test riêng.
- Nếu tính repository vào coverage của unit/API thì số liệu tổng bị kéo thấp,
  không phản ánh đúng mục tiêu từng suite.

Kết quả coverage gần nhất:

```text
All files     84.83% statements/lines
Branches      66.15%
Functions     100%
src/middlewares 100%
src/services  100%
```

Một số điểm còn thấp:

- `text.js`: mới được phủ gián tiếp qua community controller, chưa có unit test riêng.
- Một số nhánh lỗi `500` ở controller/API level chưa được phủ hết.

## 8. Kết Quả Chạy Gần Nhất

Unit:

```text
npm test
Test Files  18 passed
Tests       100 passed
```

API:

```text
npm run test:api
Test Files  1 passed
Tests       13 passed
```

Integration:

```text
npm run test:integration
Test Files  1 passed
Tests       5 passed
```

Coverage:

```text
npm run test:coverage
Test Files  19 passed
Tests       113 passed
Coverage    84.83%
```
