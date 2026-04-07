CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE vehicle_status_enum AS ENUM ('available', 'busy', 'maintenance');

CREATE TYPE request_status_enum AS ENUM (
    'pending', 'accepted', 'heading', 'arrived',
    'processing', 'completed', 'cancelled'
);

CREATE TYPE message_sender_enum AS ENUM ('user', 'company');


-- 1. Bảng người dùng cá nhân (người gặp sự cố xe)
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    user_name VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,           -- lưu hash, không lưu plain text
    full_name VARCHAR(100),
    user_phone VARCHAR(20) UNIQUE NOT NULL,
    user_email VARCHAR(100) UNIQUE,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 2. Bảng công ty cứu hộ (company)
CREATE TABLE companies (
    company_id BIGSERIAL PRIMARY KEY,
    company_name VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,           -- lưu hash, không lưu plain text
    relative_address TEXT,
    absolute_address GEOGRAPHY(Point, 4326) NOT NULL,              -- kiểu GEOGRAPHY cho GPS
    company_phone VARCHAR(20) UNIQUE NOT NULL,
    rescue_area TEXT,                     -- ví dụ: "Quận 1, Quận 3, ..."
    company_license TEXT,                                -- số giấy phép hoặc đường dẫn file
    is_verified BOOLEAN DEFAULT FALSE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 3. Bảng danh mục dịch vụ cứu hộ (services)
CREATE TABLE services (
    service_id BIGSERIAL PRIMARY KEY,
    service_name VARCHAR(100) UNIQUE NOT NULL,                  -- "Vá lốp", "Kéo xe", "Nạp xăng", ...
    service_description TEXT
);
-- 4. Bảng liên kết: công ty cung cấp dịch vụ nào (many-to-many)
CREATE TABLE company_services (
    company_id BIGINT REFERENCES companies(company_id) ON DELETE CASCADE NOT NULL,
    service_id BIGINT REFERENCES services(service_id) ON DELETE CASCADE NOT NULL,
    service_price DECIMAL(12,2) NOT NULL CHECK (service_price >= 0),                        -- giá cụ thể của công ty
    PRIMARY KEY (company_id, service_id)
);
-- 5. Bảng phương tiện cứu hộ của công ty
CREATE TABLE rescue_vehicles (
    vehicle_id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(company_id) ON DELETE CASCADE NOT NULL,
    vehicle_license VARCHAR(20) UNIQUE NOT NULL,    --Biển số phương tiện
    vehicle_type VARCHAR(50) NOT NULL,         -- "Xe kéo", "Xe cứu hộ kỹ thuật", ...
    vehicle_status vehicle_status_enum DEFAULT 'available'
);
-- 6. Bảng yêu cầu cứu hộ (requests) - bảng trung tâm
CREATE TABLE requests (
    request_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    company_id BIGINT REFERENCES companies(company_id) ON DELETE SET NULL,
    vehicle_id BIGINT REFERENCES rescue_vehicles(vehicle_id) ON DELETE SET NULL,
    absolute_location GEOGRAPHY(Point, 4326) NOT NULL,
    relative_location TEXT,
    request_description TEXT,
    request_status request_status_enum DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_arrival TIMESTAMP,
    actual_arrival TIMESTAMP,
    completed_at TIMESTAMP
);
-- 7. Bảng ảnh của yêu cầu cứu hộ
CREATE TABLE request_images (
    image_id BIGSERIAL PRIMARY KEY,
    image_url TEXT NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) ON DELETE CASCADE NOT NULL
);
-- 8. Bảng liên kết: yêu cầu cung cấp dịch vụ nào (many-to-many)
CREATE TABLE request_services (
    request_id BIGINT REFERENCES requests(request_id) ON DELETE CASCADE NOT NULL,
    service_id BIGINT REFERENCES services(service_id) ON DELETE CASCADE NOT NULL,
    service_quantity INTEGER CHECK (service_quantity > 0),                         -- số lượng mỗi dịch vụ được yêu cầu
    service_price DECIMAL(12,2) NOT NULL CHECK (service_price >= 0),         -- Đơn giá tại thời điểm yêu cầu
    PRIMARY KEY (request_id, service_id)
);
-- 9. Bảng tin nhắn chat (messages)
CREATE TABLE messages (
    message_id BIGSERIAL PRIMARY KEY,
    request_id BIGINT REFERENCES requests(request_id) ON DELETE CASCADE NOT NULL,
    message_sender message_sender_enum NOT NULL,
    message_content TEXT NOT NULL,
    is_seen BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 10. Bảng đánh giá (reviews)
CREATE TABLE reviews (
    review_id BIGSERIAL PRIMARY KEY,
    request_id BIGINT UNIQUE REFERENCES requests(request_id) ON DELETE CASCADE NOT NULL,
    review_rating INTEGER CHECK (review_rating BETWEEN 1 AND 5) NOT NULL,
    review_comment TEXT,
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 11. Bảng thẻ bài đăng (tags)
CREATE TABLE tags (
    tag_id BIGSERIAL PRIMARY KEY,
    tag_name VARCHAR(100) UNIQUE NOT NULL
);

-- 12. Bảng bài đăng tư vấn cộng đồng (posts)
CREATE TABLE posts (
    post_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    post_title VARCHAR(255) NOT NULL,
    post_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 13. Bảng liên kết: bài đăng được gắn thẻ nào (many-to-many)
CREATE TABLE post_tags (
    post_id BIGINT REFERENCES posts(post_id) ON DELETE CASCADE NOT NULL,
    tag_id BIGINT REFERENCES tags(tag_id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (post_id, tag_id)
);
-- 14. Bảng ảnh của bài đăng cộng đồng
CREATE TABLE post_images (
    image_id BIGSERIAL PRIMARY KEY,
    image_url TEXT NOT NULL,
    post_id BIGINT REFERENCES posts(post_id) ON DELETE CASCADE NOT NULL
);
-- 15. Bảng bình luận cộng đồng
CREATE TABLE comments (
    comment_id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(post_id) ON DELETE CASCADE NOT NULL,
    user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    comment_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 16. Bảng liên kết: người dùng nào like post nào
CREATE TABLE post_likes (
    post_id BIGINT REFERENCES posts(post_id) ON DELETE CASCADE NOT NULL,
    user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);
-- 17. Bảng liên kết: người dùng nào like comment nào
CREATE TABLE comment_likes (
    comment_id BIGINT REFERENCES comments(comment_id) ON DELETE CASCADE NOT NULL,
    user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id)
);





-- Tăng tốc query phổ biến
-- =========================
-- REQUESTS (quan trọng nhất)
-- =========================

-- User xem lịch sử request
CREATE INDEX idx_requests_user_created 
ON requests(user_id, created_at DESC);

-- Company xử lý request theo trạng thái
CREATE INDEX idx_requests_company_status 
ON requests(company_id, request_status);

-- Các request đang hoạt động (dispatch realtime)
CREATE INDEX idx_requests_active 
ON requests(request_status)
WHERE request_status IN ('pending', 'accepted', 'heading');

-- =========================
-- MESSAGES (chat realtime)
-- =========================

-- Load chat theo request
CREATE INDEX idx_messages_request_time 
ON messages(request_id, sent_at);

-- Tin nhắn chưa đọc
CREATE INDEX idx_messages_unseen 
ON messages(request_id)
WHERE is_seen = false;

-- =========================
-- RESCUE VEHICLES
-- =========================

-- Tìm xe available của company
CREATE INDEX idx_vehicle_company_status 
ON rescue_vehicles(company_id, vehicle_status);

-- =========================
-- LOCATION (tìm gần nhất)
-- =========================

-- Company location
CREATE INDEX idx_companies_location 
ON companies USING GIST (absolute_address);

-- Request location
CREATE INDEX idx_requests_location 
ON requests USING GIST (absolute_location);

-- =========================
-- RELATION TABLES
-- =========================

-- Load services của request
CREATE INDEX idx_request_services_request 
ON request_services(request_id);

-- Load ảnh của request
CREATE INDEX idx_request_images_request 
ON request_images(request_id);

-- =========================
-- COMMUNITY
-- =========================

-- Load feed bài đăng
CREATE INDEX idx_posts_created 
ON posts(created_at DESC);

-- Load comment theo post
CREATE INDEX idx_comments_post 
ON comments(post_id);

-- Đếm like
CREATE INDEX idx_post_likes_post 
ON post_likes(post_id);

