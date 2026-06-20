CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE vehicle_status_enum AS ENUM ('available', 'busy', 'maintenance');

CREATE TYPE request_status_enum AS ENUM (
    'pending', 'accepted', 'heading', 'arrived',
    'processing', 'completed', 'cancelled'
);

CREATE TYPE message_sender_enum AS ENUM ('user', 'company');

CREATE TYPE user_role_enum AS ENUM ('user', 'admin');


-- 1. Bảng người dùng cá nhân (người gặp sự cố xe)
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    user_name VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,           -- lưu hash, không lưu plain text
    full_name VARCHAR(100),
    user_phone VARCHAR(20) UNIQUE NOT NULL,
    user_email VARCHAR(100) UNIQUE,
    avatar_url TEXT,
    user_role user_role_enum DEFAULT 'user',
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
    avatar_url TEXT,
    rescue_area TEXT,                     -- ví dụ: "Quận 1, Quận 3, ..."
    company_license TEXT,                                -- số giấy phép hoặc đường dẫn file
    verification_document_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
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
    vehicle_status vehicle_status_enum DEFAULT 'available',
    equipment_description TEXT,
    current_location GEOGRAPHY(Point, 4326)
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
    request_note TEXT,
    assignment_mode VARCHAR(20) DEFAULT 'manual',
    issue_type VARCHAR(50),
    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_back_now BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'normal',
    request_status request_status_enum DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_arrival TIMESTAMP,
    accepted_at TIMESTAMP,
    heading_at TIMESTAMP,
    arrived_at TIMESTAMP,
    actual_arrival TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_by VARCHAR(20),
    cancel_reason TEXT,
    final_price DECIMAL(12,2),
    user_confirmed_at TIMESTAMP
);

CREATE TABLE request_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    request_id BIGINT REFERENCES requests(request_id) ON DELETE CASCADE NOT NULL,
    old_status request_status_enum,
    new_status request_status_enum NOT NULL,
    changed_by VARCHAR(20) NOT NULL,
    note TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Dùng khi nâng cấp một CSDL đã được tạo từ phiên bản cũ.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS request_note TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS assignment_mode VARCHAR(20) DEFAULT 'manual';

CREATE TABLE notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    recipient_type VARCHAR(20) NOT NULL,
    recipient_id BIGINT NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    post_status VARCHAR(20) DEFAULT 'published',
    category VARCHAR(100),
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
    comment_status VARCHAR(20) DEFAULT 'published',
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

CREATE TABLE content_reports (
    report_id BIGSERIAL PRIMARY KEY,
    reporter_user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
WHERE request_status IN ('pending', 'accepted', 'heading', 'arrived', 'processing');

CREATE INDEX idx_request_status_history_request
ON request_status_history(request_id, changed_at);

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

CREATE INDEX idx_vehicle_current_location
ON rescue_vehicles USING GIST (current_location);

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

CREATE INDEX idx_reviews_request
ON reviews(request_id);

CREATE INDEX idx_notifications_recipient
ON notifications(recipient_type, recipient_id, is_read, created_at DESC);

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
