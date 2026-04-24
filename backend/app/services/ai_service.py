class AIService:
    async def decompose_script(self, script: str) -> list[dict]:
        # 演示版 mock：按段落拆分为分镜
        lines = [line.strip() for line in (script or "").splitlines() if line.strip()]
        if not lines:
            lines = ["主角在清晨街道出现，开始第一场戏。", "人物对话推进剧情。", "冲突出现并留下悬念。"]

        scenes = []
        for idx, line in enumerate(lines[:8], start=1):
            scenes.append(
                {
                    "scene_index": idx,
                    "prompt": f"电影感镜头，{line}",
                    "characters": ["主角"],
                    "scene_description": line,
                    "dialogue": "",
                    "camera_angle": "中景",
                    "emotion": "自然",
                }
            )
        return scenes


ai_service = AIService()
