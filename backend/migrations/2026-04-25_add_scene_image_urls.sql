ALTER TABLE scenes
ADD COLUMN image_urls JSON NULL COMMENT 'AI生成的分镜图片URL列表（JSON数组）' AFTER image_url;
