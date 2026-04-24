from __future__ import annotations

import html
import os
from typing import Any

import gradio as gr
import requests


def _api(method: str, base_url: str, path: str, token: str | None = None, payload: dict | None = None) -> tuple[bool, Any]:
    url = base_url.rstrip("/") + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = requests.request(method=method, url=url, headers=headers, json=payload, timeout=40)
        data = None
        try:
            data = resp.json()
        except Exception:
            data = resp.text
        if resp.status_code >= 400:
            detail = data.get("detail") if isinstance(data, dict) else str(data)
            return False, f"[{resp.status_code}] {detail}"
        return True, data
    except requests.RequestException as exc:
        return False, f"网络请求失败: {exc}"


def _scene_choices(scenes: list[dict]) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    for s in scenes:
        sid = str(s.get("id"))
        idx = s.get("scene_index", "?")
        desc = s.get("scene_description") or s.get("prompt") or "未命名分镜"
        items.append((f"Scene {idx} · {desc[:24]}", sid))
    return items


def _find_scene(scene_id: str | None, scenes: list[dict]) -> dict | None:
    if not scene_id:
        return None
    for s in scenes:
        if str(s.get("id")) == str(scene_id):
            return s
    return None


def _preview_html(scene: dict | None) -> str:
    if not scene:
        return "<div class='preview-empty'>请选择分镜</div>"
    img = scene.get("image_url")
    vid = scene.get("video_url")
    parts = ["<div class='preview-wrap'>"]
    if img:
        parts.append(f"<img class='preview-image' src='{html.escape(img)}' alt='scene' />")
    else:
        parts.append("<div class='preview-empty'>尚未生成图片</div>")
    if vid:
        parts.append(
            f"<video class='preview-video' controls src='{html.escape(vid)}'></video>"
        )
    parts.append("</div>")
    return "".join(parts)


def _dialogue_anim_html(dialogue: str) -> str:
    text = (dialogue or "").strip()
    if not text:
        return "<div class='dialogue-empty'>暂无台词，可在右侧编辑后预览。</div>"
    words = [w for w in text.split() if w]
    if not words:
        words = list(text)
    spans = []
    for i, w in enumerate(words):
        safe = html.escape(w)
        spans.append(f"<span style='animation-delay:{i * 0.08:.2f}s'>{safe}</span>")
    return f"<div class='dialogue-anim'>{''.join(spans)}</div>"


def _scenes_table_html(scenes: list[dict]) -> str:
    if not scenes:
        return "<div class='preview-empty'>暂无分镜数据</div>"
    rows = []
    for s in scenes:
        rows.append(
            "<tr>"
            f"<td>{html.escape(str(s.get('id', '')))}</td>"
            f"<td>{html.escape(str(s.get('scene_index', '')))}</td>"
            f"<td>{html.escape(str(s.get('scene_description', '') or ''))}</td>"
            f"<td>{html.escape(str(s.get('status', 'pending')))}</td>"
            "</tr>"
        )
    return (
        "<div class='scene-table-wrap'>"
        "<table class='scene-table'>"
        "<thead><tr><th>ID</th><th>序号</th><th>描述</th><th>状态</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody>"
        "</table></div>"
    )


def do_login(base_url: str, username: str, password: str):
    ok, data = _api("POST", base_url, "/auth/login", payload={"username": username, "password": password})
    if not ok:
        return "", {}, "登录失败", gr.update(), [], gr.update(choices=[], value=None), "", "", "", "", "", "", "", "<div class='preview-empty'>请先登录</div>", "<div class='dialogue-empty'>请先登录</div>"
    token = data["access_token"]
    user = data["user"]
    tips = f"登录成功：{user.get('username')}（{user.get('role')}）"
    return (
        token,
        user,
        tips,
        gr.update(value=""),
        [],
        gr.update(choices=[], value=None),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "<div class='preview-empty'>请创建或选择项目后开始</div>",
        "<div class='dialogue-empty'>请输入台词以查看字字动画预览</div>",
    )


def create_project(base_url: str, token: str, title: str, script: str):
    if not token:
        return "", "请先登录"
    ok, data = _api("POST", base_url, "/projects/", token=token, payload={"title": title, "script": script})
    if not ok:
        return "", f"创建失败：{data}"
    return str(data["id"]), f"项目创建成功：ID={data['id']}"


def decompose_project(base_url: str, token: str, project_id: str):
    if not token:
        return [], gr.update(choices=[], value=None), gr.update(value=_scenes_table_html([])), "请先登录"
    if not project_id:
        return [], gr.update(choices=[], value=None), gr.update(value=_scenes_table_html([])), "请先创建项目"
    ok, data = _api("POST", base_url, f"/projects/{project_id}/decompose", token=token, payload={})
    if not ok:
        return [], gr.update(choices=[], value=None), gr.update(value=_scenes_table_html([])), f"拆解失败：{data}"
    scenes = data if isinstance(data, list) else []
    choices = _scene_choices(scenes)
    selected = choices[0][1] if choices else None
    return scenes, gr.update(choices=choices, value=selected), gr.update(value=_scenes_table_html(scenes)), f"拆解完成，共 {len(scenes)} 条分镜"


def load_scene(scene_id: str, scenes: list[dict]):
    scene = _find_scene(scene_id, scenes)
    if not scene:
        return "", "", "", "", "", "", "<div class='preview-empty'>请选择分镜</div>", "<div class='dialogue-empty'>暂无台词</div>"
    chars = scene.get("characters")
    chars_text = ",".join(chars) if isinstance(chars, list) else ""
    dialogue = scene.get("dialogue") or ""
    return (
        str(scene.get("scene_index", "")),
        chars_text,
        scene.get("scene_description", "") or "",
        dialogue,
        scene.get("camera_angle", "") or "",
        scene.get("emotion", "") or "",
        _preview_html(scene),
        _dialogue_anim_html(dialogue),
    )


def save_scene(base_url: str, token: str, scene_id: str, scenes: list[dict], scene_index: str, characters: str, scene_description: str, dialogue: str, camera_angle: str, emotion: str, prompt: str):
    if not token:
        return scenes, gr.update(), "请先登录"
    if not scene_id:
        return scenes, gr.update(), "请先选择分镜"
    payload = {
        "scene_index": int(scene_index or 1),
        "characters": [c.strip() for c in characters.split(",") if c.strip()],
        "scene_description": scene_description,
        "dialogue": dialogue,
        "camera_angle": camera_angle,
        "emotion": emotion,
        "prompt": prompt,
    }
    ok, data = _api("PUT", base_url, f"/api/scenes/{scene_id}", token=token, payload=payload)
    if not ok:
        return scenes, gr.update(), f"保存失败：{data}"
    new_scenes = []
    for s in scenes:
        if str(s.get("id")) == str(scene_id):
            new_scenes.append(data)
        else:
            new_scenes.append(s)
    return new_scenes, gr.update(value=_scenes_table_html(new_scenes)), "分镜已保存"


def gen_image(base_url: str, token: str, scene_id: str, scenes: list[dict]):
    if not token or not scene_id:
        return scenes, gr.update(), "<div class='preview-empty'>请选择分镜</div>", "请先登录并选择分镜"
    ok, data = _api("POST", base_url, f"/api/scenes/{scene_id}/generate-image", token=token, payload={})
    if not ok:
        return scenes, gr.update(), "<div class='preview-empty'>生成失败</div>", f"图片生成失败：{data}"
    new_scenes = [data if str(s.get("id")) == str(scene_id) else s for s in scenes]
    return new_scenes, gr.update(value=_scenes_table_html(new_scenes)), _preview_html(data), "图片生成完成"


def gen_video(base_url: str, token: str, scene_id: str, scenes: list[dict]):
    if not token or not scene_id:
        return scenes, gr.update(), "<div class='preview-empty'>请选择分镜</div>", "请先登录并选择分镜"
    ok, data = _api("POST", base_url, f"/api/scenes/{scene_id}/generate-video", token=token, payload={})
    if not ok:
        return scenes, gr.update(), "<div class='preview-empty'>生成失败</div>", f"视频生成失败：{data}"
    new_scenes = [data if str(s.get("id")) == str(scene_id) else s for s in scenes]
    return new_scenes, gr.update(value=_scenes_table_html(new_scenes)), _preview_html(data), "视频生成完成"


def submit_review(base_url: str, token: str, project_id: str, decision: str, comment: str):
    if not token:
        return "请先登录"
    if not project_id:
        return "请先创建项目"
    if decision == "rejected" and not comment.strip():
        return "驳回时请填写意见"
    ok, data = _api("POST", base_url, "/api/reviews/", token=token, payload={
        "project_id": int(project_id),
        "status": decision,
        "comment": comment.strip(),
    })
    if not ok:
        return f"提交审核失败：{data}"
    return f"审核提交成功：{decision}"


def build_ui():
    css = """
    .gradio-container { max-width: 1400px !important; }
    .hero { background: linear-gradient(135deg,#0f172a,#1e3a8a); border-radius:16px; padding:18px; color:#e2e8f0; }
    .hero h1 { margin:0; font-size:26px; }
    .hero p { margin:6px 0 0 0; color:#cbd5e1; }
    .preview-wrap { display:flex; flex-direction:column; gap:10px; }
    .preview-image,.preview-video { width:100%; border-radius:12px; border:1px solid #334155; }
    .preview-empty,.dialogue-empty { color:#94a3b8; border:1px dashed #334155; border-radius:12px; padding:18px; text-align:center; }
    .dialogue-anim { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .dialogue-anim span { opacity:0; transform:translateY(8px); animation:wordin .35s ease forwards; background:#1d4ed8; color:#fff; border-radius:8px; padding:4px 8px; }
    .scene-table-wrap { border:1px solid #334155; border-radius:10px; overflow:hidden; }
    .scene-table { width:100%; border-collapse:collapse; font-size:13px; }
    .scene-table th,.scene-table td { border-bottom:1px solid #334155; padding:8px 10px; text-align:left; }
    .scene-table th { background:#0f172a; color:#cbd5e1; }
    .scene-table td { color:#e2e8f0; background:#111827; }
    @keyframes wordin { to { opacity:1; transform:translateY(0); } }
    """
    with gr.Blocks(css=css, title="字字动画创作台") as demo:
        gr.HTML("<div class='hero'><h1>字字动画创作台（网页版）</h1><p>不是后台管理界面，而是创作流程前端：登录 -> 剧本 -> 分镜 -> 生成 -> 审核</p></div>")

        token_state = gr.State("")
        user_state = gr.State({})
        scenes_state = gr.State([])

        with gr.Row():
            backend_url = gr.Textbox(label="后端地址", value=os.getenv("BACKEND_URL", "http://127.0.0.1:8000"), scale=2)
            login_status = gr.Textbox(label="状态", value="请先登录", interactive=False, scale=3)

        with gr.Row():
            with gr.Column(scale=1):
                gr.Markdown("### 1) 登录")
                username = gr.Textbox(label="用户名", value="admin")
                password = gr.Textbox(label="密码", type="password", value="admin123456")
                login_btn = gr.Button("登录并进入创作台", variant="primary")

                gr.Markdown("### 2) 项目与剧本")
                project_title = gr.Textbox(label="项目标题", value="我的字字动画短片")
                script_text = gr.Textbox(label="剧本文案", lines=8, value="主角走进雨夜街道。\n他停下脚步，看向远处霓虹。\n旁白：每一个字，都有自己的节奏。")
                project_id = gr.Textbox(label="项目ID", interactive=False, value="")
                create_btn = gr.Button("创建项目", variant="secondary")
                decompose_btn = gr.Button("AI拆解分镜", variant="secondary")

                gr.Markdown("### 5) 审核提交")
                decision = gr.Radio(label="审核结论", choices=["approved", "rejected"], value="approved")
                review_comment = gr.Textbox(label="审核意见", lines=3, placeholder="驳回时请填写原因")
                review_btn = gr.Button("提交审核", variant="primary")

            with gr.Column(scale=2):
                gr.Markdown("### 3) 分镜列表")
                scenes_table = gr.HTML(value=_scenes_table_html([]), label="分镜列表")
                scene_select = gr.Dropdown(label="选择分镜", choices=[], value=None)

                with gr.Row():
                    scene_index = gr.Textbox(label="序号", scale=1)
                    scene_characters = gr.Textbox(label="角色（逗号）", scale=2)
                scene_description = gr.Textbox(label="场景描述", lines=2)
                scene_dialogue = gr.Textbox(label="台词")
                scene_camera = gr.Textbox(label="镜头语言")
                scene_emotion = gr.Textbox(label="情绪")
                scene_prompt = gr.Textbox(label="Prompt", lines=2)

                with gr.Row():
                    save_scene_btn = gr.Button("保存分镜", variant="secondary")
                    gen_image_btn = gr.Button("文生图", variant="secondary")
                    gen_video_btn = gr.Button("图生视频", variant="secondary")

            with gr.Column(scale=2):
                gr.Markdown("### 4) 预览（网页前端风格）")
                preview = gr.HTML("<div class='preview-empty'>请选择分镜</div>")
                gr.Markdown("#### 字字动画台词预览")
                dialogue_preview = gr.HTML("<div class='dialogue-empty'>请输入台词以查看字字动画预览</div>")

        global_msg = gr.Textbox(label="系统消息", value="准备就绪", interactive=False)

        login_btn.click(
            fn=do_login,
            inputs=[backend_url, username, password],
            outputs=[
                token_state, user_state, login_status, project_id,
                scenes_state, scene_select, scene_index, scene_characters, scene_description,
                scene_dialogue, scene_camera, scene_emotion, scene_prompt,
                preview, dialogue_preview,
            ],
        )
        create_btn.click(
            fn=create_project,
            inputs=[backend_url, token_state, project_title, script_text],
            outputs=[project_id, global_msg],
        )
        decompose_btn.click(
            fn=decompose_project,
            inputs=[backend_url, token_state, project_id],
            outputs=[scenes_state, scene_select, scenes_table, global_msg],
        )
        scene_select.change(
            fn=load_scene,
            inputs=[scene_select, scenes_state],
            outputs=[scene_index, scene_characters, scene_description, scene_dialogue, scene_camera, scene_emotion, preview, dialogue_preview],
        )
        save_scene_btn.click(
            fn=save_scene,
            inputs=[backend_url, token_state, scene_select, scenes_state, scene_index, scene_characters, scene_description, scene_dialogue, scene_camera, scene_emotion, scene_prompt],
            outputs=[scenes_state, scenes_table, global_msg],
        )
        gen_image_btn.click(
            fn=gen_image,
            inputs=[backend_url, token_state, scene_select, scenes_state],
            outputs=[scenes_state, scenes_table, preview, global_msg],
        )
        gen_video_btn.click(
            fn=gen_video,
            inputs=[backend_url, token_state, scene_select, scenes_state],
            outputs=[scenes_state, scenes_table, preview, global_msg],
        )
        scene_dialogue.change(fn=_dialogue_anim_html, inputs=[scene_dialogue], outputs=[dialogue_preview])
        review_btn.click(
            fn=submit_review,
            inputs=[backend_url, token_state, project_id, decision, review_comment],
            outputs=[global_msg],
        )
    return demo


if __name__ == "__main__":
    app = build_ui()
    app.launch(server_name="0.0.0.0", server_port=int(os.getenv("GRADIO_PORT", "7860")))
