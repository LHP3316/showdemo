-- 分镜软删除字段
ALTER TABLE `scenes`
  ADD COLUMN `is_deleted` TINYINT NOT NULL DEFAULT 0 COMMENT '软删除标记：0=正常,1=已删除' AFTER `status`,
  ADD COLUMN `deleted_at` DATETIME NULL COMMENT '软删除时间' AFTER `is_deleted`;

-- 常用查询索引（项目下仅查未删除分镜）
CREATE INDEX `idx_scenes_project_deleted` ON `scenes` (`project_id`, `is_deleted`, `scene_index`);

