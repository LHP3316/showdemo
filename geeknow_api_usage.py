from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import List

from geeknow_image_api import GeekNowImageAPI
from geeknow_video_api import GeekNowVideoAPI


GUIDE = r"""
GeekNow 接口调用说明（本脚本对应 2 个类）：

一、图片接口类：GeekNowImageAPI（文件：geeknow_image_api.py）
1) generate_openai_image(model, prompt, size, image_inputs=None, n=1, response_format=None)
   - 方式：POST {base_url}/v1/images/generations
   - 关键参数：
     model            模型名，如 grok-4-2-image / doubao-seedream-5-0-260128 / gpt-image-2
     prompt           提示词
     size             尺寸，如 2560x1440
     image_inputs     参考图列表（URL 或本地路径）
     n                生成数量
     response_format  可选 url 或 b64_json（按网关能力）

2) generate_gemini_image(model, prompt, aspect_ratio='16:9', image_size='1K', reference_images=None)
   - 方式：POST {base_url}/v1beta/models/{model}:generateContent
   - 关键参数：
     model             Gemini 模型名
     prompt            提示词
     aspect_ratio      比例，如 16:9 / 9:16 / 1:1
     image_size        1K / 2K
     reference_images  参考图列表（URL 或本地路径）


二、视频接口类：GeekNowVideoAPI（文件：geeknow_video_api.py）
1) create_video_task_json(payload)
   - 方式：POST {base_url}/v1/videos (JSON)
   - 常见 payload 字段：
     model, prompt, seconds, size, metadata.output_config.aspect_ratio, metadata.output_config.audio_generation

2) create_video_task_multipart(data, files)
   - 方式：POST {base_url}/v1/videos (multipart/form-data)
   - data 常见字段：model/prompt/seconds/size
   - files 格式：[(field_name, file_name, file_bytes, mime_type), ...]

3) get_video_task_status(task_id)
   - 方式：GET {base_url}/v1/videos/{task_id}

4) poll_until_completed(task_id, poll_interval=10, max_attempts=300)
   - 持续轮询状态，直到完成并返回 video_url

5) download_video(video_url, output_path, task_id=None)
   - 先下 video_url，失败时可用 task_id 走 /v1/videos/{task_id}/content 兜底
"""


def run_image_openai(args: argparse.Namespace) -> None:
    api = GeekNowImageAPI(api_key=args.api_key, base_url=args.base_url, timeout=args.timeout)
    image_inputs: List[str] = []
    if args.image:
        image_inputs.append(args.image)
    resp = api.generate_openai_image(
        model=args.model,
        prompt=args.prompt,
        size=args.size,
        image_inputs=image_inputs or None,
        n=args.n,
        response_format=args.response_format,
    )
    print(json.dumps(resp, ensure_ascii=False, indent=2))


def run_image_gemini(args: argparse.Namespace) -> None:
    api = GeekNowImageAPI(api_key=args.api_key, base_url=args.base_url, timeout=args.timeout)
    refs = [args.image] if args.image else None
    resp = api.generate_gemini_image(
        model=args.model,
        prompt=args.prompt,
        aspect_ratio=args.aspect_ratio,
        image_size=args.image_size,
        reference_images=refs,
    )
    print(json.dumps(resp, ensure_ascii=False, indent=2))


def run_video_json(args: argparse.Namespace) -> None:
    api = GeekNowVideoAPI(api_key=args.api_key, base_url=args.base_url, timeout=args.timeout)
    payload = {
        "model": args.model,
        "prompt": args.prompt,
        "seconds": str(args.seconds),
        "size": args.size,
        "metadata": {
            "output_config": {
                "aspect_ratio": args.aspect_ratio,
                "audio_generation": args.audio_generation,
            }
        },
    }
    create_resp = api.create_video_task_json(payload)
    print("创建任务响应:")
    print(json.dumps(create_resp, ensure_ascii=False, indent=2))
    task_id = create_resp.get("id")
    if not task_id:
        raise RuntimeError("响应中没有 id，无法继续轮询")

    video_url = api.poll_until_completed(task_id, poll_interval=args.poll_interval, max_attempts=args.max_attempts)
    print(f"任务完成，video_url: {video_url}")

    if args.output:
        saved = api.download_video(video_url, args.output, task_id=task_id)
        print(f"视频已下载: {saved}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="GeekNow 图片/视频 API 调用示例脚本",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=GUIDE,
    )
    parser.add_argument("--api-key", default=os.getenv("GEEKNOW_API_KEY", ""), help="API Key；可用环境变量 GEEKNOW_API_KEY")
    parser.add_argument("--base-url", default="https://api.geeknow.top", help="中转 Base URL")
    parser.add_argument("--timeout", type=int, default=120, help="请求超时秒数")

    sub = parser.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("image-openai", help="调用 OpenAI 兼容图片接口")
    p1.add_argument("--model", required=True)
    p1.add_argument("--prompt", required=True)
    p1.add_argument("--size", default="2560x1440")
    p1.add_argument("--image", help="可选参考图（URL 或本地路径）")
    p1.add_argument("--n", type=int, default=1)
    p1.add_argument("--response-format", default=None)
    p1.set_defaults(func=run_image_openai)

    p2 = sub.add_parser("image-gemini", help="调用 Gemini 图片接口")
    p2.add_argument("--model", required=True)
    p2.add_argument("--prompt", required=True)
    p2.add_argument("--aspect-ratio", default="16:9")
    p2.add_argument("--image-size", default="1K")
    p2.add_argument("--image", help="可选参考图（URL 或本地路径）")
    p2.set_defaults(func=run_image_gemini)

    p3 = sub.add_parser("video-json", help="调用 JSON 生视频接口并轮询下载")
    p3.add_argument("--model", required=True)
    p3.add_argument("--prompt", required=True)
    p3.add_argument("--seconds", type=int, default=5)
    p3.add_argument("--size", default="1280x720")
    p3.add_argument("--aspect-ratio", default="16:9")
    p3.add_argument("--audio-generation", default="Disabled", choices=["Enabled", "Disabled"])
    p3.add_argument("--poll-interval", type=int, default=10)
    p3.add_argument("--max-attempts", type=int, default=300)
    p3.add_argument("--output", help="可选，本地保存路径（.mp4）")
    p3.set_defaults(func=run_video_json)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if not args.api_key:
        raise SystemExit("请传 --api-key 或设置环境变量 GEEKNOW_API_KEY")
    args.func(args)


if __name__ == "__main__":
    main()

