# Claude Chat

一个轻量的 ChatUI，让你能使用 Claude Code 的请求头来进行对话，从而可以用那些只接受 Claude Code 的 API 来聊天。

基于 Flask + 原生 JS，支持多提供商配置、双模型对比、联网搜索（Anthropic tool_use）、文件/图片附件、流式思考输出。

## 功能

- **使用 Claude Code 请求头**：自动生成稳定的 device_id，加上 Claude Code 的 anthropic-beta 标志，让限定 Claude Code 接入的 API 也能正常对话
- **多提供商**：每个提供商独立配置 URL、Key 和模型组，新增模型不用重配连接
- **Direct / Dual 模式**：单模型直聊，或双模型并排对比（用户消息共享，助手上下文独立）
- **联网搜索**：通过 Anthropic tool_use 协议调用外部搜索 API
- **附件**：图片、PDF（直接送入模型）、DOCX 和文本/代码文件（作为文本块）
- **流式输出**：text + thinking 实时显示，断网自动重试
- **本地存储**：对话和设置保存在浏览器，导入导出 JSON 备份

## 安装与运行

```bash
pip install -r requirements.txt
python app.py
```

默认监听 `0.0.0.0:5000`。浏览器打开 `http://<host>:5000`。

首次启动会在项目根目录生成 `.device_id`（基于主机名 + MAC 的 SHA256），用于 upstream 的设备标识。删除该文件会重新生成新的 ID。

## 配置

打开网页，左下角菜单 → 设置：

1. **提供商管理**：填 URL、API Key 和模型列表（逗号分隔）。可以加多个
2. **当前模型选择**：分别为单模型、双模型 A/B 选择提供商和模型
3. **联网搜索**（可选）：填搜索 API URL 和 Key，模型会按需调用
4. **生成参数**：effort（思考强度）、max tokens
5. **System Prompt**：全局默认提示词

## 联网搜索 API 约定

后端会向你配置的搜索 URL 发 POST：

```
POST <searchUrl>
Authorization: Bearer <searchKey>
Content-Type: application/json

{"query": "...", "lang": "zh"}
```

期望返回：

```json
{"code": 200, "msg": "success", "data": "<搜索结果文本>"}
```

兼容 grok-search 风格的接口（如 `https://apii.xianyuw.cn/api/v1/grok-search`）。

## License

MIT
