CREATE DATABASE IF NOT EXISTS showdemo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE showdemo;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID，主键自增',
    username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名，唯一',
    password VARCHAR(100) NOT NULL COMMENT '密码（建议存储哈希值）',
    role ENUM('director', 'staff', 'writer', 'reviewer') DEFAULT 'staff' COMMENT '角色：director导演，staff工作人员，writer编剧，reviewer审核',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) COMMENT='用户表';

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '项目ID，主键自增',
    title VARCHAR(255) NOT NULL COMMENT '项目标题',
    script TEXT COMMENT '剧本内容',
    status ENUM('draft','processing','review','approved','rejected','exported') DEFAULT 'draft' COMMENT '项目状态：草稿/处理中/待审核/已通过/已驳回/已导出',
    created_by INT COMMENT '创建人用户ID（关联users.id）',
    assigned_to INT COMMENT '当前分配执行人用户ID（关联users.id）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
) COMMENT='项目表（剧本项目主表）';

-- 分镜表
CREATE TABLE IF NOT EXISTS scenes (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '分镜ID，主键自增',
    project_id INT NOT NULL COMMENT '所属项目ID（关联projects.id）',
    scene_index INT NOT NULL COMMENT '分镜序号（项目内排序）',
    prompt TEXT COMMENT '生成提示词',
    image_url TEXT COMMENT '分镜图片URL',
    video_url TEXT COMMENT '分镜视频URL',
    status ENUM('pending','done') DEFAULT 'pending' COMMENT '分镜状态：pending待处理，done已完成',
    characters JSON COMMENT '角色信息（JSON结构）',
    scene_description TEXT COMMENT '场景描述',
    dialogue TEXT COMMENT '台词内容',
    camera_angle VARCHAR(100) COMMENT '镜头语言/机位',
    emotion VARCHAR(100) COMMENT '情绪描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) COMMENT='分镜表';

-- 审核表
CREATE TABLE IF NOT EXISTS reviews (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '审核记录ID，主键自增',
    project_id INT NOT NULL COMMENT '项目ID（关联projects.id）',
    reviewer_id INT NOT NULL COMMENT '审核人用户ID（关联users.id）',
    status ENUM('approved','rejected') NOT NULL COMMENT '审核结果：approved通过，rejected驳回',
    comment TEXT COMMENT '审核意见',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '审核时间',
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
) COMMENT='项目审核记录表';

-- Prompt配置表
CREATE TABLE IF NOT EXISTS prompt_configs (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '配置ID，主键自增',
    type ENUM('text2img','img2video','img2img') NOT NULL COMMENT '配置类型：文生图/图生视频/图生图',
    name VARCHAR(100) COMMENT '配置名称',
    config JSON COMMENT '配置内容（JSON结构）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) COMMENT='Prompt配置表';

-- 插入默认导演用户（若不存在）
INSERT INTO users (username, password, role)
SELECT 'admin', '$2b$12$P1Q7ZB8f0nR8t2Yh.0d9W.lQmQmI6I1mPydf0fQw8m8d5I7aT8k7K', 'director'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');
