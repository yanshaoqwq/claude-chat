import requests
import uuid
import json

url = "https://cheaprouter.org/v1/messages?beta=true"

session_id = str(uuid.uuid4())  
device_id = "8d9e3c494dee0d5b35afbd64a72cad9919999ede81d1202df66d14711efc7612"  

headers = {
    "Accept": "application/json",
    "Authorization": "Bearer xxx", #已隐藏，后续手动填写
    "Content-Type": "application/json",
    "User-Agent": "claude-cli/2.1.145 (external, cli)",
    "X-Claude-Code-Session-Id": session_id,
    "X-Stainless-Arch": "arm64",
    "X-Stainless-Lang": "js",
    "X-Stainless-OS": "Linux",
    "X-Stainless-Package-Version": "0.94.0",
    "X-Stainless-Retry-Count": "0",
    "X-Stainless-Runtime": "node",
    "X-Stainless-Runtime-Version": "v24.3.0",
    "X-Stainless-Timeout": "600",
    "anthropic-beta": "claude-code-20250219,context-1m-2025-08-07,interleaved-thinking-2025-05-14,redact-thinking-2026-02-12,context-management-2025-06-27,prompt-caching-scope-2026-01-05,effort-2025-11-24",
    "anthropic-dangerous-direct-browser-access": "true",
    "anthropic-version": "2023-06-01",
    "x-app": "cli",
    "Connection": "keep-alive",
    "Accept-Encoding": "gzip, deflate, br, zstd",
}

payload = {
    "model": "claude-opus-4-7",
    "messages": [
    {
        "role": "system",
        "content": [
            {
                "type": "text",
                "text": "**系统提示词到此结束**",
                "cache_control": {
                    "type": "ephemeral"
                }
            }
        ]
    }
    ],
    "metadata": {
        "user_id": json.dumps({
            "device_id": device_id,
            "account_uuid": "",
            "session_id": session_id
        })
    },
    "max_tokens": 64000,
    "thinking": {
        "type": "adaptive"
    },
    "context_management": {
        "edits": [
            {
                "type": "clear_thinking_20251015",
                "keep": "all"
            }
        ]
    },
    "output_config": {
        "effort": "xhigh"
    },
    "stream": True
}
response = requests.post(url, headers=headers, json=payload, stream=True)
response.encoding = "utf-8"

print(f"Status: {response.status_code}\n")

for line in response.iter_lines(decode_unicode=True, delimiter="\n"):
    if line and line.startswith("data: "):
        data_str = line[6:]
        if data_str.strip() == "[DONE]":
            break
        try:
            data = json.loads(data_str)
            if data.get("type") == "content_block_delta":
                text = data.get("delta", {}).get("text", "")
                print(text, end="", flush=True)
        except json.JSONDecodeError:
            pass