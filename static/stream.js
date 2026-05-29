// ─── Streaming ───────────────────────────────────────────────────────────────
async function send() {
  const text = els.input.value.trim();
  const hasAtt = pendingAttachments.length > 0;
  if (!text && !hasAtt) return;
  const atts = pendingAttachments.filter((a) => a.status === "ready").map((a) => ({
    name: a.name, kind: a.kind, media_type: a.media_type, data: a.data,
    text: a.text, chars: a.chars, size: a.size,
    mode: a.mode, extracted_text: a.extracted_text, extracted_chars: a.extracted_chars,
    pages: a.pages,
  }));
  pendingAttachments = [];
  renderAttachments();
  pushMessage("user", text, { attachments: atts, side: null });
  els.input.value = ""; autoGrow(els.input);
  await streamReply();
}

async function uploadFile(f) {
  if (f.size > 20 * 1024 * 1024) {
    showToast(`${f.name} 过大（最大 20MB）`, "error");
    return;
  }
  const placeholder = { id: newId(), name: f.name, status: "uploading" };
  pendingAttachments.push(placeholder);
  renderAttachments();
  try {
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch("/api/extract", { method: "POST", body: fd });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "解析失败");
    placeholder.status = "ready";
    placeholder.kind = data.kind;
    placeholder.size = data.size;
    if (data.kind === "pdf") {
      placeholder.media_type = data.media_type;
      placeholder.data = data.data;
      placeholder.extracted_text = data.extracted_text || "";
      placeholder.extracted_chars = data.extracted_chars || 0;
      placeholder.pages = data.pages || 0;
      placeholder.mode = placeholder.extracted_chars > 0 ? "text" : "base64";
    } else if (data.kind === "image") {
      placeholder.media_type = data.media_type;
      placeholder.data = data.data;
    } else {
      placeholder.text = data.text;
      placeholder.chars = data.chars;
    }
    renderAttachments();
    showToast(`已附加 ${f.name}`);
  } catch (e) {
    pendingAttachments = pendingAttachments.filter((x) => x.id !== placeholder.id);
    renderAttachments();
    showToast(`${f.name}: ${e.message}`, "error");
  }
}
function attMeta(a) {
  if (a.status === "uploading") return "解析中…";
  if (a.kind === "pdf") return `PDF · ${(a.size / 1024).toFixed(0)}KB`;
  if (a.kind === "image") return `图片 · ${(a.size / 1024).toFixed(0)}KB`;
  return `${a.chars > 9999 ? (a.chars / 1000).toFixed(1) + "k" : a.chars} 字`;
}

function renderAttachments() {
  const wrap = els.attachments;
  wrap.innerHTML = "";
  if (!pendingAttachments.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  for (const a of pendingAttachments) {
    const el = document.createElement("div");
    el.className = "attachment" + (a.status === "uploading" ? " uploading" : "");
    if (a.kind === "image" && a.data) {
      const img = document.createElement("img");
      img.className = "att-thumb";
      img.src = `data:${a.media_type};base64,${a.data}`;
      el.appendChild(img);
    } else {
      const icon = document.createElement("span");
      icon.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      el.appendChild(icon);
    }
    const name = document.createElement("span");
    name.className = "att-name"; name.textContent = a.name;
    const meta = document.createElement("span");
    meta.className = "att-meta"; meta.textContent = attMeta(a);
    el.appendChild(name); el.appendChild(meta);

    if (a.kind === "pdf" && a.status === "ready") {
      const toggle = document.createElement("button");
      toggle.className = "att-mode";
      toggle.type = "button";
      const isText = a.mode === "text";
      toggle.textContent = isText ? "文本" : "原文件";
      toggle.title = isText
        ? `已提取为文本（${a.extracted_chars} 字 / ${a.pages} 页）。点击改为发送 PDF 原文件`
        : "发送 PDF 原文件。点击改为发送提取的文本";
      if (!a.extracted_chars) {
        toggle.disabled = true;
        toggle.title = "未能从此 PDF 提取出文本，将发送原文件";
      }
      toggle.onclick = (e) => {
        e.stopPropagation();
        a.mode = a.mode === "text" ? "base64" : "text";
        renderAttachments();
      };
      el.appendChild(toggle);
    }

    const close = document.createElement("button");
    close.className = "att-close"; close.title = "移除";
    close.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.onclick = () => {
      pendingAttachments = pendingAttachments.filter((x) => x.id !== a.id);
      renderAttachments();
    };
    el.appendChild(close);
    wrap.appendChild(el);
  }
}

function preflightCheck(side) {
  const pid = side === "A" ? settings.providerA : side === "B" ? settings.providerB : settings.activeProvider;
  const mdl = side === "A" ? settings.modelA : side === "B" ? settings.modelB : settings.activeModel;
  const p = getProvider(pid);
  if (!p || !p.apiKey) {
    showToast(`${side ? side + " 侧" : ""}提供商未配置 API Key`, "error");
    openSettings();
    return null;
  }
  if (!mdl) {
    showToast(`${side ? side + " 侧" : ""}未选择模型`, "error");
    openSettings();
    return null;
  }
  return { provider: p, model: mdl };
}

async function streamReply() {
  const c = getActive(); if (!c) return;
  if (settings.webSearchEnabled && (!settings.searchUrl || !settings.searchKey)) {
    showToast("已启用联网搜索，请在设置里填写搜索 URL 和 Key", "error");
    openSettings();
    return;
  }
  if (c.mode === "dual") {
    const a = preflightCheck("A");
    const b = preflightCheck("B");
    if (!a || !b) return;
    const phA = pushMessage("assistant", "", { streaming: true, thinking: "", tools: [], side: "A", providerName: a.provider.name, model: a.model });
    const phB = pushMessage("assistant", "", { streaming: true, thinking: "", tools: [], side: "B", providerName: b.provider.name, model: b.model });
    setBusy(true);
    currentAbort = new AbortController();
    try {
      await Promise.allSettled([
        runOneStream(a.provider, a.model, "A", phA, currentAbort.signal),
        runOneStream(b.provider, b.model, "B", phB, currentAbort.signal),
      ]);
    } finally {
      setBusy(false); currentAbort = null;
    }
    return;
  }
  const sel = preflightCheck(null);
  if (!sel) return;
  const placeholder = pushMessage("assistant", "", { streaming: true, thinking: "", tools: [], side: null, providerName: sel.provider.name, model: sel.model });
  setBusy(true);
  currentAbort = new AbortController();
  try {
    await runOneStream(sel.provider, sel.model, null, placeholder, currentAbort.signal);
  } finally {
    setBusy(false); currentAbort = null;
  }
}

function streamReplyWithHistory(oldMsg) {
  const c = getActive(); if (!c) return;
  if (settings.webSearchEnabled && (!settings.searchUrl || !settings.searchKey)) {
    showToast("已启用联网搜索，请在设置里填写搜索 URL 和 Key", "error");
    openSettings();
    return;
  }
  const sel = preflightCheck(null);
  if (!sel) return;
  const placeholder = pushMessage("assistant", "", {
    streaming: true, thinking: "", tools: [], side: null,
    providerName: sel.provider.name, model: sel.model,
    history: oldMsg ? oldMsg.history : null,
    historyIndex: oldMsg && oldMsg.history ? oldMsg.history.length : 0,
  });
  setBusy(true);
  currentAbort = new AbortController();
  (async () => {
    try {
      await runOneStream(sel.provider, sel.model, null, placeholder, currentAbort.signal);
      if (placeholder.role !== "error" && placeholder.history) {
        placeholder.history.push({ content: placeholder.content, thinking: placeholder.thinking || "", tools: placeholder.tools || [] });
        placeholder.historyIndex = placeholder.history.length - 1;
        touchActive();
        renderMessages();
      }
    } finally {
      setBusy(false); currentAbort = null;
    }
  })();
}

async function streamReplyOneSide(side, oldMsg) {
  const c = getActive(); if (!c) return;
  if (settings.webSearchEnabled && (!settings.searchUrl || !settings.searchKey)) {
    showToast("已启用联网搜索，请在设置里填写搜索 URL 和 Key", "error");
    openSettings();
    return;
  }
  const sel = preflightCheck(side);
  if (!sel) return;
  const placeholder = pushMessage("assistant", "", {
    streaming: true, thinking: "", tools: [], side,
    providerName: sel.provider.name, model: sel.model,
    history: oldMsg ? oldMsg.history : null,
    historyIndex: oldMsg && oldMsg.history ? oldMsg.history.length : 0,
  });
  setBusy(true);
  currentAbort = new AbortController();
  try {
    await runOneStream(sel.provider, sel.model, side, placeholder, currentAbort.signal);
    if (placeholder.role !== "error" && placeholder.history) {
      placeholder.history.push({ content: placeholder.content, thinking: placeholder.thinking || "", tools: placeholder.tools || [] });
      placeholder.historyIndex = placeholder.history.length - 1;
      touchActive();
      renderMessages();
    }
  } finally {
    setBusy(false); currentAbort = null;
  }
}

function buildMessagesForSide(c, placeholderId, side) {
  return c.messages
    .filter((m) => m.id !== placeholderId)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.role === "user" || m.side === side || m.side === null)
    .map((m) => ({ role: m.role, content: m.content, attachments: m.attachments || [] }));
}

async function runOneStream(provider, model, side, placeholder, signal) {
  const c = getActive();
  const sysText = c.systemPrompt || settings.systemPrompt;
  const body = {
    api_key: provider.apiKey,
    upstream_url: provider.url,
    model,
    effort: settings.effort,
    max_tokens: settings.maxTokens,
    system: sysText,
    web_search_enabled: settings.webSearchEnabled,
    search_url: settings.searchUrl,
    search_key: settings.searchKey,
    messages: buildMessagesForSide(c, placeholder.id, side),
  };
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(body),
    });
    if (!resp.ok && resp.status !== 200) {
      const errText = await resp.text();
      placeholder.role = "error";
      placeholder.content = `HTTP ${resp.status}: ${errText}`;
      placeholder.streaming = false;
      saveConvs(); renderMessages();
      return;
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let saw = false;
    outer: while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        const line = event.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const data = line.slice(6);
        if (data.trim() === "[DONE]") break outer;
        try { handleEvent(JSON.parse(data), placeholder); saw = true; } catch (e) {}
      }
    }
    placeholder.streaming = false;
    if (!saw && !placeholder.content) {
      placeholder.role = "error";
      placeholder.content = "未收到任何数据";
    }
    touchActive(); renderMessages(); renderHeader();
  } catch (e) {
    if (e.name === "AbortError") {
      placeholder.streaming = false;
      placeholder.content += "\n\n_[已停止]_";
    } else {
      placeholder.role = "error";
      placeholder.content = "请求失败: " + e.message;
      placeholder.streaming = false;
    }
    saveConvs(); renderMessages();
  }
}

function handleEvent(evt, msg) {
  const type = evt.type;
  if (type === "error") {
    msg.role = "error";
    msg.content = evt.message || JSON.stringify(evt);
    msg.streaming = false;
    updateStreaming(msg);
  } else if (type === "content_block_delta") {
    const d = evt.delta || {};
    if (d.type === "text_delta" || d.type === undefined) msg.content += d.text || "";
    else if (d.type === "thinking_delta") msg.thinking = (msg.thinking || "") + (d.thinking || "");
    updateStreaming(msg);
  } else if (type === "tool_use_start") {
    msg.tools = msg.tools || [];
    msg.tools.push({ id: evt.tool_id, name: evt.name, status: "running", query: "" });
    if (msg.content && !msg.content.endsWith("\n\n")) msg.content += "\n\n";
    if (msg.thinking) msg.thinking += "\n\n— — —\n\n";
    updateStreaming(msg);
  } else if (type === "tool_use_input") {
    const t = (msg.tools || []).find((x) => x.id === evt.tool_id);
    if (t) {
      t.query = (evt.input && evt.input.query) || "";
      t.input = evt.input;
      updateToolCard(msg, t);
    }
  } else if (type === "tool_result") {
    const t = (msg.tools || []).find((x) => x.id === evt.tool_id);
    if (t) {
      if (evt.error) { t.error = evt.error; t.status = "error"; }
      else { t.result = evt.result || {}; t.status = "done"; }
      updateToolCard(msg, t);
    }
  }
}

function findMsgEl(msg) {
  return els.messages.querySelector(`.msg[data-id="${msg.id}"]`);
}

function updateStreaming(msg) {
  const wrap = findMsgEl(msg);
  if (!wrap) { renderMessages(); return; }
  const body = wrap.querySelector(".msg-body");
  const content = body.querySelector(".msg-content");
  let thinkingEl = body.querySelector(".thinking");
  if (msg.thinking) {
    if (!thinkingEl) {
      thinkingEl = renderThinking(msg.thinking);
      const firstTool = body.querySelector(".tool-card");
      body.insertBefore(thinkingEl, firstTool || content);
    } else {
      thinkingEl.querySelector(".thinking-body").textContent = msg.thinking;
    }
  } else if (thinkingEl) {
    thinkingEl.remove();
  }
  for (const t of msg.tools || []) {
    if (!body.querySelector(`.tool-card[data-tool-id="${t.id}"]`)) {
      body.insertBefore(renderToolCard(t), content);
    }
  }
  if (msg.role === "error") {
    wrap.classList.remove("assistant"); wrap.classList.add("error");
    const avatar = wrap.querySelector(".msg-avatar"); if (avatar) avatar.textContent = "!";
    const role = wrap.querySelector(".msg-role"); if (role) role.textContent = "Error";
  }
  content.textContent = msg.content;
  if (msg.streaming) content.dataset.streaming = "1";
  else delete content.dataset.streaming;
  if (!msg.content && (msg.tools && msg.tools.length)) {
    content.style.display = "none";
  } else {
    content.style.display = "";
  }
  if (msg.streaming) {
    const caret = document.createElement("span");
    caret.className = "streaming-caret";
    content.appendChild(caret);
  }
  if (scrollPinned) scrollToBottom();
}

function updateToolCard(msg, t) {
  const wrap = findMsgEl(msg);
  if (!wrap) return;
  const card = wrap.querySelector(`.tool-card[data-tool-id="${t.id}"]`);
  if (card) fillToolCard(card, t);
  if (scrollPinned) scrollToBottom();
}

function setBusy(busy) {
  els.sendBtn.disabled = busy;
  els.stopBtn.disabled = !busy;
  els.input.disabled = busy;
}

function autoGrow(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 280) + "px";
}
function scrollToBottom() { els.messages.scrollTop = els.messages.scrollHeight; }
