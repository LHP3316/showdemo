-- ============================================================
-- 合并迁移：为 projects 增加剧本工位所需字段
-- 创建日期: 2026-04-25
-- 说明:
-- - 适用于已执行过 init_db_v2.sql 的数据库
-- - 可重复执行：会先判断列是否存在，再决定是否新增
-- - 仅新增字段，不会修改/删除现有数据
-- ============================================================

-- 请先切换到你的数据库
-- USE your_database_name;

-- 1) writer_name（编剧显示名）
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'writer_name'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE projects ADD COLUMN writer_name VARCHAR(100) NULL COMMENT ''编剧显示名（可选；无编剧账号体系时使用）'' AFTER script',
  'SELECT ''skip: writer_name exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) episode_title（当前集标题）
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'episode_title'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE projects ADD COLUMN episode_title VARCHAR(255) NULL COMMENT ''当前集标题（可选；用于剧本工位展示）'' AFTER writer_name',
  'SELECT ''skip: episode_title exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) episode_summary（当前集简介）
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'episode_summary'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE projects ADD COLUMN episode_summary TEXT NULL COMMENT ''当前集简介（可选；与项目简介分离）'' AFTER episode_title',
  'SELECT ''skip: episode_summary exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 可选：如果你希望老项目默认把“编剧”显示为创建人姓名，可以执行下面这段回填（按需开启）
-- UPDATE projects p
-- JOIN users u ON u.id = p.created_by
-- SET p.writer_name = COALESCE(NULLIF(TRIM(p.writer_name), ''), NULLIF(TRIM(u.display_name), ''), u.username)
-- WHERE p.writer_name IS NULL OR TRIM(p.writer_name) = '';

