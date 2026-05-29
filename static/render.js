// ─── Render: messages ────────────────────────────────────────────────────────
function renderMessages() {
  els.messages.innerHTML = "";
  const c = getActive();
  if (!c || c.messages.length === 0) {
    renderEmptyMessages();
    return;
  }
  if (c.mode === "dual") {
    renderMessagesDual(c);
  } else {
    for (const m of c.messages) els.messages.appendChild(renderMessage(m, c));
  }
  scrollToBottom();
}

function renderMessagesDual(c) {
  let i = 0;
  while (i < c.messages.length) {
    const m = c.messages[i];
    if (m.role === "user") {
      els.messages.appendChild(renderMessage(m, c));
      i++;
      continue;
    }
    let sideA = m.side === "A" ? m : null;
    let sideB = m.side === "B" ? m : null;
    let j = i + 1;
    while (j < c.messages.length && c.messages[j].role !== "user") {
      const mj = c.messages[j];
      if (mj.side === "A" && !sideA) sideA = mj;
      else if (mj.side === "B" && !sideB) sideB = mj;
      else break;
      j++;
      if (sideA && sideB) break;
    }
    if (m.side === null) {
      els.messages.appendChild(renderMessage(m, c));
      i++;
    } else {
      els.messages.appendChild(renderDualRow(sideA, sideB, c));
      i = Math.max(j, i + 1);
    }
  }
}

function renderDualRow(sideA, sideB, conv) {
  const row = document.createElement("div");
  row.className = "msg-row-dual";
  row.appendChild(renderDualColumn("A", sideA, conv));
  row.appendChild(renderDualColumn("B", sideB, conv));
  return row;
}
function renderDualColumn(side, msg, conv) {
  const col = document.createElement("div");
  col.className = "msg-dual-col";
  const label = document.createElement("div");
  label.className = "msg-side-label";
  const pid = side === "A" ? settings.providerA : settings.providerB;
  const mdl = side === "A" ? settings.modelA : settings.modelB;
  const pname = (getProvider(pid) || {}).name || "?";
  if (msg && msg.providerName) {
    label.textContent = `${side} · ${msg.providerName} / ${msg.model || mdl}`;
  } else {
    label.textContent = `${side} · ${pname} / ${mdl}`;
  }
  col.appendChild(label);
  if (msg) {
    col.appendChild(renderMessage(msg, conv));
  } else {
    const ph = document.createElement("div");
    ph.className = "msg-dual-placeholder";
    ph.textContent = "（暂无）";
    col.appendChild(ph);
  }
  return col;
}

function renderEmptyMessages() {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.innerHTML = `
    <div class="empty-icon">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </div>
    <h2>开始一段对话</h2>
    <p>发送消息或在设置里配置提供商。</p>`;
  els.messages.appendChild(div);
}

function renderMessage(m, conv) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + m.role;
  wrap.dataset.id = m.id;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  if (m.role === "user" && settings.userAvatarImage) {
    avatar.style.backgroundImage = `url(${settings.userAvatarImage})`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
  } else if (m.role === "assistant" && settings.aiAvatarImage) {
    avatar.style.backgroundImage = `url(${settings.aiAvatarImage})`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
  } else {
    avatar.textContent = m.role === "user" ? settings.userAvatar : m.role === "assistant" ? settings.aiAvatar : "!";
  }
  wrap.appendChild(avatar);

  const body = document.createElement("div");
  body.className = "msg-body";

  const meta = document.createElement("div");
  meta.className = "msg-meta";
  const role = document.createElement("span");
  role.className = "msg-role";
  role.textContent = m.role === "user" ? settings.userName : m.role === "assistant" ? settings.aiName : "Error";
  meta.appendChild(role);

  if (m.history && m.history.length > 1) {
    const histNav = document.createElement("span");
    histNav.className = "msg-history-nav";
    const idx = m.historyIndex || 0;
    const prev = document.createElement("button");
    prev.className = "hist-btn";
    prev.textContent = "‹";
    prev.disabled = idx <= 0;
    prev.onclick = (e) => { e.stopPropagation(); navigateHistory(m, -1); };
    const label = document.createElement("span");
    label.className = "hist-label";
    label.textContent = `${idx + 1}/${m.history.length}`;
    const next = document.createElement("button");
    next.className = "hist-btn";
    next.textContent = "›";
    next.disabled = idx >= m.history.length - 1;
    next.onclick = (e) => { e.stopPropagation(); navigateHistory(m, 1); };
    histNav.appendChild(prev);
    histNav.appendChild(label);
    histNav.appendChild(next);
    meta.appendChild(histNav);
  }

  body.appendChild(meta);

  if (m.thinking) body.appendChild(renderThinking(m.thinking));
  if (m.tools && m.tools.length) {
    for (const t of m.tools) body.appendChild(renderToolCard(t));
  }
  if (m.attachments && m.attachments.length) body.appendChild(renderMsgAttachments(m.attachments, false, m));

  const content = document.createElement("div");
  content.className = "msg-content";
  if (m.role === "assistant" && !m.streaming) {
    content.innerHTML = renderMarkdown(m.content || "");
    attachCodeBlockExtras(content);
  } else {
    content.textContent = m.content || "";
    if (m.streaming) content.dataset.streaming = "1";
  }
  if (m.role === "assistant" && !(m.content || "").trim() && !m.streaming) {
    content.style.display = "none";
  }
  if (m.streaming && !m.content && !m.thinking && !(m.tools && m.tools.length)) {
    content.textContent = settings.waitingText || "";
    content.classList.add("waiting");
  }
  if (m.streaming) {
    const caret = document.createElement("span");
    caret.className = "streaming-caret";
    content.appendChild(caret);
  }
  body.appendChild(content);

  const actions = document.createElement("div");
  actions.className = "msg-actions";
  actions.appendChild(makeIconBtn(ICON.edit, "编辑", () => startEdit(m.id)));
  if (m.role === "user") {
    actions.appendChild(makeIconBtn(ICON.refresh, "重发（截断到这里）", () => resendFrom(m.id)));
    if (m.content) {
      actions.appendChild(makeIconBtn(ICON.copy, "复制", () => {
        navigator.clipboard.writeText(m.content).then(() => showToast("已复制"));
      }));
    }
  }
  if (m.role === "assistant" && m.content) {
    actions.appendChild(makeIconBtn(ICON.refresh, "重新生成这条回复", () => regenerateAt(m.id)));
    actions.appendChild(makeIconBtn(ICON.copy, "复制", () => {
      navigator.clipboard.writeText(m.content).then(() => showToast("已复制"));
    }));
  }
  if (m.role === "assistant" && !m.streaming) {
    if (m.side === "A" || m.side === "B") {
      actions.appendChild(makeIconBtn(ICON.merge, "合并为单条（选用此回复）", () => mergeMessage(m.id)));
    } else if (m.side === null && conv.mode === "single") {
      actions.appendChild(makeIconBtn(ICON.branch, "新建分支（生成双模型对比）", () => branchMessage(m.id)));
    }
  }
  actions.appendChild(makeIconBtn(ICON.trash, "删除", () => deleteMessage(m.id)));
  body.appendChild(actions);

  wrap.appendChild(body);
  return wrap;
}
function navigateHistory(m, dir) {
  const idx = (m.historyIndex || 0) + dir;
  if (idx < 0 || idx >= m.history.length) return;
  m.historyIndex = idx;
  const entry = m.history[idx];
  m.content = entry.content;
  m.thinking = entry.thinking || "";
  m.tools = entry.tools || [];
  m.attachments = entry.attachments || m.attachments;
  touchActive();
  renderMessages();
  renderHeader();
}

function makeIconBtn(svg, title, onClick) {
  const b = document.createElement("button");
  b.className = "icon"; b.title = title; b.innerHTML = svg; b.onclick = onClick;
  return b;
}

function renderThinking(text) {
  const det = document.createElement("details");
  det.className = "thinking";
  const sum = document.createElement("summary");
  sum.textContent = "思考过程";
  det.appendChild(sum);
  const body = document.createElement("div");
  body.className = "thinking-body";
  body.textContent = text;
  det.appendChild(body);
  return det;
}

function renderToolCard(t) {
  const card = document.createElement("div");
  card.className = "tool-card";
  card.dataset.toolId = t.id;
  if (t.error) card.classList.add("error");
  if (t.status === "done" || t.status === "error") card.classList.add("done");
  const head = document.createElement("div");
  head.className = "tool-card-head";
  head.innerHTML = `
    <span class="tool-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>
    <span class="tool-card-title">web_search</span>
    <span class="tool-card-query"></span>
    <span class="tool-card-status"><span class="dot"></span><span class="status-text"></span></span>
    <span class="tool-card-toggle">▸</span>
  `;
  card.appendChild(head);
  const body = document.createElement("div");
  body.className = "tool-card-body";
  card.appendChild(body);
  head.onclick = () => card.classList.toggle("open");
  fillToolCard(card, t);
  return card;
}

function fillToolCard(card, t) {
  const head = card.querySelector(".tool-card-head");
  const queryEl = head.querySelector(".tool-card-query");
  queryEl.textContent = t.query ? `"${t.query}"` : (t.input ? "参数解析中…" : "等待参数…");
  const statusText = head.querySelector(".status-text");
  card.classList.toggle("error", !!t.error);
  card.classList.toggle("done", t.status === "done" || t.status === "error");
  if (t.error) statusText.textContent = "失败";
  else if (t.status === "done") statusText.textContent = "已完成";
  else if (t.status === "running") statusText.textContent = "搜索中…";
  else statusText.textContent = "调用中…";
  const body = card.querySelector(".tool-card-body");
  body.innerHTML = "";
  const argsObj = t.input || (t.query ? { query: t.query } : {});
  const argsSec = document.createElement("div");
  argsSec.className = "tool-section";
  argsSec.innerHTML =
    `<div class="tool-section-label">调用参数</div>` +
    `<pre class="tool-args">${escapeHtml(JSON.stringify(argsObj, null, 2))}</pre>`;
  body.appendChild(argsSec);
  if (t.error) {
    const sec = document.createElement("div");
    sec.className = "tool-section";
    sec.innerHTML = `<div class="tool-section-label">错误</div><div>${escapeHtml(t.error)}</div>`;
    body.appendChild(sec);
    return;
  }
  const r = t.result;
  if (!r) return;
  if (r.content) {
    const sec = document.createElement("div");
    sec.className = "tool-section";
    sec.innerHTML = `<div class="tool-section-label">搜索结果</div><div class="tool-summary">${renderMarkdown(r.content)}</div>`;
    body.appendChild(sec);
  }
}
function renderMsgAttachments(atts, editing, msg) {
  const wrap = document.createElement("div");
  wrap.className = "msg-attachments";
  for (const a of atts) {
    if (a.kind === "image" && a.data) {
      const img = document.createElement("img");
      img.className = "msg-attachment-image";
      img.src = `data:${a.media_type};base64,${a.data}`;
      img.alt = a.name || "image";
      img.title = a.name || "";
      img.onclick = () => openImageViewer(img.src, a.name);
      wrap.appendChild(img);
      continue;
    }
    const el = document.createElement("div");
    el.className = "msg-attachment";
    let meta;
    if (a.kind === "pdf") meta = `PDF · ${(a.size / 1024).toFixed(0)}KB`;
    else if (a.kind === "image") meta = `图片 · ${(a.size / 1024).toFixed(0)}KB`;
    else meta = `${a.chars > 9999 ? (a.chars / 1000).toFixed(1) + "k" : a.chars} 字`;
    el.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="att-name">${escapeHtml(a.name)}</span>
      <span class="att-meta">${meta}</span>
    `;
    if (a.kind === "pdf") {
      if (editing) {
        const toggle = document.createElement("button");
        toggle.className = "att-mode";
        toggle.type = "button";
        const isText = a.mode === "text";
        toggle.textContent = isText ? "文本" : "原文件";
        toggle.title = isText
          ? `已提取为文本（${a.extracted_chars || 0} 字）。点击改为发送 PDF 原文件`
          : "发送 PDF 原文件。点击改为发送提取的文本";
        if (!a.extracted_chars) {
          toggle.disabled = true;
          toggle.title = "未能从此 PDF 提取出文本";
        }
        toggle.onclick = (e) => {
          e.stopPropagation();
          a.mode = a.mode === "text" ? "base64" : "text";
          touchActive();
          const t = a.mode === "text";
          toggle.textContent = t ? "文本" : "原文件";
          toggle.title = t
            ? `已提取为文本（${a.extracted_chars || 0} 字）。点击改为发送 PDF 原文件`
            : "发送 PDF 原文件。点击改为发送提取的文本";
        };
        el.appendChild(toggle);
      } else {
        const desc = document.createElement("span");
        desc.className = "att-mode-desc";
        desc.textContent = a.mode === "text" ? "以文本形式发送" : "以原文件形式发送";
        el.appendChild(desc);
      }
    }
    if (a.kind === "pdf" && a.data) {
      el.classList.add("clickable");
      el.onclick = (ev) => { if (!ev.target.closest(".att-mode")) openPdfViewer(a); };
    }
    wrap.appendChild(el);
  }
  return wrap;
}

function openPdfViewer(a) {
  const blob = b64ToBlob(a.data, a.media_type || "application/pdf");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function openImageViewer(src, name) {
  const overlay = document.createElement("div");
  overlay.className = "img-viewer";
  overlay.innerHTML = `<img src="${src}" alt="${escapeHtml(name || "")}">`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

function b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function attachCodeBlockExtras(root) {
  root.querySelectorAll("pre > code").forEach((code) => {
    const pre = code.parentElement;
    if (pre.querySelector(".copy-btn")) return;
    const btn = document.createElement("button");
    btn.className = "copy-btn"; btn.textContent = "复制";
    btn.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(code.textContent).then(
        () => { btn.textContent = "已复制"; setTimeout(() => (btn.textContent = "复制"), 1200); },
        () => showToast("复制失败", "error"),
      );
    };
    pre.appendChild(btn);
  });
}

function renderAll() { renderConvList(); renderHeader(); renderMessages(); }

// ─── Merge / Branch ─────────────────────────────────────────────────────────
function mergeMessage(id) {
  const c = getActive(); if (!c) return;
  const m = c.messages.find((x) => x.id === id);
  if (!m || (m.side !== "A" && m.side !== "B")) return;
  const idx = c.messages.indexOf(m);
  const otherSide = m.side === "A" ? "B" : "A";
  // 在同一轮内（前后 user 消息之间）找对侧
  let lo = idx - 1;
  while (lo >= 0 && c.messages[lo].role !== "user") lo--;
  let hi = idx + 1;
  while (hi < c.messages.length && c.messages[hi].role !== "user") hi++;
  const partner = c.messages.find((x, i) =>
    i > lo && i < hi && i !== idx && (x.role === "assistant" || x.role === "error") && x.side === otherSide
  );
  if (partner) c.messages = c.messages.filter((x) => x.id !== partner.id);
  m.side = null;
  if (!hasDualMessages(c)) {
    c.mode = "single";
  }
  touchActive(); renderAll();
  showToast("已合并为单条回复");
}

function branchMessage(id) {
  const c = getActive(); if (!c) return;
  const m = c.messages.find((x) => x.id === id);
  if (!m || m.role !== "assistant" || m.side !== null) return;
  m.side = "A";
  c.mode = "dual";
  touchActive(); renderAll();
  streamReplyOneSide("B", null);
  showToast("已创建分支，正在生成 B 侧回复…");
}
