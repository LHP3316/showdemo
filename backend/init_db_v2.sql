-- ============================================================
-- AI短剧协作平台 - 数据表初始化脚本
-- 版本: v2.0 (重构版)
-- 创建日期: 2026-04-24
-- 说明: 在已有数据库中创建所有表和初始数据
-- 使用方法: mysql -u root -p your_database_name < init_db_v2.sql
-- ============================================================

-- 注意：请先选择你的数据库
-- USE your_database_name;

-- ============================================================
-- 1. 用户表 (users)
-- 说明: 存储平台用户信息，包括导演和工作人员
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID，主键，自增',
    username VARCHAR(50) UNIQUE NOT NULL COMMENT '登录用户名，唯一标识',
    password VARCHAR(100) NOT NULL COMMENT '密码哈希值（bcrypt加密）',
    display_name VARCHAR(100) COMMENT '显示名称（用户真实姓名或昵称）',
    role ENUM('director', 'staff', 'writer', 'reviewer') DEFAULT 'staff' COMMENT '用户角色：director=导演, staff=工作人员, writer=编剧, reviewer=审核员',
    avatar_url VARCHAR(255) COMMENT '头像图片URL地址',
    is_active TINYINT(1) DEFAULT 1 COMMENT '账号状态：1=激活, 0=禁用',
    last_login TIMESTAMP NULL COMMENT '最后登录时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '账号创建时间',
    
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='用户表 - 存储平台所有用户的基本信息和权限';

-- ============================================================
-- 2. 项目表 (projects)
-- 说明: 短剧项目主表，一个项目对应一个剧本
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '项目ID，主键，自增',
    title VARCHAR(255) NOT NULL COMMENT '项目标题（短剧名称）',
    description TEXT COMMENT '项目描述（剧情简介、创作背景等）',
    script TEXT COMMENT '完整剧本内容（纯文本或Markdown格式）',
    genre VARCHAR(50) COMMENT '项目类型：古风/科幻/都市/悬疑/爱情等',
    episode_count INT COMMENT '总集数',
    current_episode INT DEFAULT 1 COMMENT '当前正在处理的集数',
    status ENUM('draft', 'processing', 'review', 'approved', 'rejected', 'exported') DEFAULT 'draft' COMMENT '项目状态：draft=草稿, processing=制作中, review=审核中, approved=已通过, rejected=已驳回, exported=已导出',
    created_by INT COMMENT '创建人用户ID（关联users.id，通常是导演）',
    assigned_to INT COMMENT '当前分配的执行人员ID（关联users.id，通常是工作人员）',
    deadline TIMESTAMP NULL COMMENT '项目截止日期',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '项目创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间（自动更新）',
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='项目表 - 短剧项目主表，包含剧本内容和项目状态';

-- ============================================================
-- 3. 分镜表 (scenes)
-- 说明: 项目的分镜详细信息，每个分镜包含场景描述、角色、AI提示词等
-- ============================================================
CREATE TABLE IF NOT EXISTS scenes (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '分镜ID，主键，自增',
    project_id INT NOT NULL COMMENT '所属项目ID（关联projects.id）',
    episode_number INT DEFAULT 1 COMMENT '所属集数（用于多集短剧）',
    scene_index INT NOT NULL COMMENT '分镜序号（项目或集内排序）',
    characters VARCHAR(500) COMMENT '出场角色列表（逗号分隔，如：主角,反派,配角）',
    scene_description TEXT COMMENT '场景详细描述（用于AI生成参考）',
    dialogue TEXT COMMENT '角色台词内容',
    camera_angle VARCHAR(100) COMMENT '镜头语言/机位描述（如：特写、远景、俯拍、跟拍等）',
    emotion VARCHAR(100) COMMENT '情绪氛围描述（如：紧张、温馨、悬疑、悲伤等）',
    prompt TEXT COMMENT 'AI生成提示词（英文，用于文生图/图生视频）',
    image_url TEXT COMMENT 'AI生成的分镜图片URL',
    video_url TEXT COMMENT 'AI生成的分镜视频URL',
    duration INT COMMENT '视频时长（单位：秒）',
    status ENUM('pending', 'editing', 'image_ready', 'video_ready', 'accepted') DEFAULT 'pending' COMMENT '分镜状态：pending=待编辑, editing=编辑中, image_ready=图片已生成, video_ready=视频已生成, accepted=审核通过',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '分镜创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间（自动更新）',
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    
    INDEX idx_project_id (project_id),
    INDEX idx_episode_number (episode_number),
    INDEX idx_scene_index (scene_index),
    INDEX idx_status (status),
    UNIQUE KEY uk_project_scene (project_id, episode_number, scene_index) COMMENT '唯一约束：同一项目同一集的分镜序号唯一'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='分镜表 - 存储项目的分镜详细信息和AI生成资源';

-- ============================================================
-- 4. 审核记录表 (reviews)
-- 说明: 项目的审核历史记录，每次审核生成一条记录
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '审核记录ID，主键，自增',
    project_id INT NOT NULL COMMENT '被审核的项目ID（关联projects.id）',
    reviewer_id INT NOT NULL COMMENT '审核人用户ID（关联users.id，通常是导演）',
    status ENUM('approved', 'rejected') NOT NULL COMMENT '审核结果：approved=通过, rejected=驳回',
    comment TEXT COMMENT '审核意见（驳回原因或通过备注）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '审核提交时间',
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_project_id (project_id),
    INDEX idx_reviewer_id (reviewer_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='审核记录表 - 存储项目的审核历史和结果';

-- ============================================================
-- 5. 审核意见明细表 (review_comments)
-- 说明: 审核时每个分镜的具体意见，支持逐个分镜通过/驳回
-- ============================================================
CREATE TABLE IF NOT EXISTS review_comments (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '审核意见ID，主键，自增',
    review_id INT NOT NULL COMMENT '所属审核记录ID（关联reviews.id）',
    scene_id INT NOT NULL COMMENT '被审核的分镜ID（关联scenes.id）',
    action ENUM('approved', 'rejected') NOT NULL COMMENT '对该分镜的操作：approved=通过, rejected=驳回',
    comment TEXT COMMENT '针对该分镜的具体审核意见',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '意见创建时间',
    
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
    
    INDEX idx_review_id (review_id),
    INDEX idx_scene_id (scene_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='审核意见明细表 - 存储审核时每个分镜的具体通过/驳回意见';

-- ============================================================
-- 6. AI生成任务队列表 (task_queue)
-- 说明: 异步跟踪AI生成任务（文生图、图生视频）的状态
-- ============================================================
CREATE TABLE IF NOT EXISTS task_queue (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '任务ID，主键，自增',
    scene_id INT NOT NULL COMMENT '关联的分镜ID（关联scenes.id）',
    task_type ENUM('text2img', 'img2video') NOT NULL COMMENT '任务类型：text2img=文生图, img2video=图生视频',
    status ENUM('pending', 'processing', 'success', 'failed') DEFAULT 'pending' COMMENT '任务状态：pending=排队中, processing=生成中, success=成功, failed=失败',
    progress INT DEFAULT 0 COMMENT '任务进度百分比（0-100）',
    result_url TEXT COMMENT '生成结果文件的URL（图片或视频）',
    error_message TEXT COMMENT '失败时的错误信息',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '任务创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间（自动更新）',
    
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
    
    INDEX idx_scene_id (scene_id),
    INDEX idx_status (status),
    INDEX idx_task_type (task_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='AI生成任务队列表 - 异步跟踪文生图和图生视频任务的执行状态';

-- ============================================================
-- 7. Prompt配置表 (prompt_configs)
-- 说明: 存储AI生成的Prompt模板配置
-- ============================================================
CREATE TABLE IF NOT EXISTS prompt_configs (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '配置ID，主键，自增',
    type ENUM('text2img', 'img2video', 'img2img') NOT NULL COMMENT '配置类型：text2img=文生图, img2video=图生视频, img2img=图生图',
    name VARCHAR(100) COMMENT '配置名称（如：古风场景模板、科幻风格模板）',
    config JSON COMMENT '配置内容（JSON格式，包含模型参数、风格设置等）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '配置创建时间',
    
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Prompt配置表 - 存储AI生成的Prompt模板和参数配置';

-- ============================================================
-- 初始化数据
-- ============================================================

-- 插入默认管理员用户（用户名: admin, 密码: admin123456）
-- 注意：密码是 bcrypt 加密后的哈希值
INSERT INTO users (username, password, display_name, role)
SELECT 'admin', '$2b$12$LQv9c1yq2V8R1kJ9F5qZu.K5xJ3ZqX9Y7vW8pQ2nM4rT6sU1cD3eO', '系统管理员', 'director'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- 插入示例工作人员用户（用户名: staff1, 密码: staff123456）
INSERT INTO users (username, password, display_name, role)
SELECT 'staff1', '$2b$12$X9Y7vW8pQ2nM4rT6sU1cD3eOLQv9c1yq2V8R1kJ9F5qZu.K5xJ3Zq', '示例工作人员', 'staff'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'staff1');

-- 插入默认 Prompt 配置
INSERT INTO prompt_configs (type, name, config) VALUES
('text2img', '古风场景模板', '{"model": "stable-diffusion", "style": "ancient chinese", "quality": "8k, masterpiece", "aspect_ratio": "16:9"}'),
('text2img', '科幻场景模板', '{"model": "stable-diffusion", "style": "sci-fi, futuristic", "quality": "8k, masterpiece", "aspect_ratio": "16:9"}'),
('img2video', '标准视频模板', '{"model": "runway-gen2", "duration": 4, "motion": "medium", "quality": "high"}')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================================
-- 数据库初始化完成
-- ============================================================
