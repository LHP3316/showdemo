-- Adds separate prompt/config fields for image & video generation
-- MySQL migration

ALTER TABLE scenes
  ADD COLUMN image_prompt TEXT NULL COMMENT '文生图提示词（image 专用）' AFTER prompt,
  ADD COLUMN video_prompt TEXT NULL COMMENT '图生视频提示词（video 专用）' AFTER image_prompt,
  ADD COLUMN image_config JSON NULL COMMENT '文生图参数配置（JSON，可选）' AFTER video_prompt,
  ADD COLUMN video_config JSON NULL COMMENT '图生视频参数配置（JSON，可选）' AFTER image_config;

