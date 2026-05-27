// ─── Storage Keys ────────────────────────────────────────────────────────────
const SK = {
  settings: "chatui-settings-v3",
  convs: "chatui-conversations-v3",
  active: "chatui-active-v3",
  bg: "chatui-bg-v2",
  bgCustom: "chatui-bg-custom-v2",
  opacity: "chatui-opacity-v2",
};

// ─── Settings ────────────────────────────────────────────────────────────────
const settings = {
  providers: [],
  activeProvider: "",
  activeModel: "",
  providerA: "",
  modelA: "",
  providerB: "",
  modelB: "",
  effort: "xhigh",
  maxTokens: 64000,
  systemPrompt: "",
  searchUrl: "",
  searchKey: "",
  webSearchEnabled: false,
};

let conversations = [];
let activeId = null;
let currentAbort = null;
let searchQuery = "";
let scrollPinned = true;
let pendingAttachments = [];
let draftConv = null;

// ─── Backgrounds ─────────────────────────────────────────────────────────────
const PRESETS = [
  { id: "warm-cream", name: "暖米", css: "linear-gradient(135deg, #f8edd1 0%, #f0dfb8 50%, #e8d3a3 100%)" },
  { id: "peach-sun", name: "蜜桃", css: "linear-gradient(135deg, #fde6c5 0%, #f7c9a3 50%, #efb38a 100%)" },
  { id: "sand-rose", name: "沙玫", css: "linear-gradient(135deg, #fbe7d0 0%, #f0c9b9 50%, #d9a597 100%)" },
  { id: "olive-honey", name: "橄榄蜜", css: "linear-gradient(135deg, #f3ecc4 0%, #e2d089 50%, #c0a657 100%)" },
  { id: "linen", name: "亚麻", css: "linear-gradient(135deg, #f7efe1 0%, #ece1cb 50%, #ddcfb3 100%)" },
  { id: "morning", name: "晨光", css: "linear-gradient(135deg, #fff4e0 0%, #f8e0c0 50%, #efc497 100%)" },
  { id: "paper-grid", name: "纸纹", css: "repeating-linear-gradient(0deg, #f6ecd2 0px, #f6ecd2 24px, #f0e4c4 25px), repeating-linear-gradient(90deg, transparent 0px, transparent 24px, rgba(122,95,60,0.05) 25px)" },
  { id: "soft-dots", name: "暖点", css: "radial-gradient(circle at 20% 20%, #fde9c5 0%, transparent 40%), radial-gradient(circle at 80% 70%, #f5d6a8 0%, transparent 45%), #f3e6c5" },
];

// ─── DOM ─────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const els = {
  bgLayer: $("bgLayer"),
  sidebar: $("sidebar"),
  sidebarToggle: $("sidebarToggle"),
  newChatBtn: $("newChatBtn"),
  searchInput: $("searchInput"),
  searchClear: $("searchClear"),
  convList: $("convList"),
  menuBtn: $("menuBtn"),
  convTitle: $("convTitle"),
  renameTitleBtn: $("renameTitleBtn"),
  modeSegment: $("modeSegment"),
  modelPickers: $("modelPickers"),
  convStat: $("convStat"),
  messages: $("messages"),
  input: $("input"),
  sendBtn: $("sendBtn"),
  stopBtn: $("stopBtn"),
  webSearchBtn: $("webSearchBtn"),
  attachBtn: $("attachBtn"),
  attachFile: $("attachFile"),
  attachments: $("attachments"),
  toast: $("toast"),
  modalRoot: $("modalRoot"),
};

const ICON = {
  edit: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
};

// ─── Utils ───────────────────────────────────────────────────────────────────
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

if (window.marked) {
  marked.setOptions({
    breaks: true, gfm: true,
    highlight: (code, lang) => {
      if (window.hljs && lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(code, { language: lang }).value; } catch (e) {}
      }
      if (window.hljs) { try { return hljs.highlightAuto(code).value; } catch (e) {} }
      return code;
    },
  });
}

function renderMarkdown(text) {
  if (!text) return "";
  if (window.marked) return marked.parse(text);
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function showToast(text, type = "") {
  els.toast.textContent = text;
  els.toast.className = "toast show" + (type ? " " + type : "");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toTimeString().slice(0, 5);
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()}`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Provider helpers ────────────────────────────────────────────────────────
function getProvider(id) { return settings.providers.find((p) => p.id === id); }

function ensureValidSelections() {
  if (settings.providers.length === 0) return;
  const valid = (pid, mid) => {
    const p = getProvider(pid);
    return p && (p.models || []).includes(mid);
  };
  if (!valid(settings.activeProvider, settings.activeModel)) {
    const p = settings.providers[0];
    settings.activeProvider = p.id;
    settings.activeModel = (p.models || [])[0] || "";
  }
  if (!valid(settings.providerA, settings.modelA)) {
    settings.providerA = settings.activeProvider;
    settings.modelA = settings.activeModel;
  }
  if (!valid(settings.providerB, settings.modelB)) {
    const others = settings.providers.find((p) => p.id !== settings.providerA) || settings.providers[0];
    settings.providerB = others.id;
    settings.modelB = (others.models || [])[0] || settings.activeModel;
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────
function loadAll() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(SK.settings) || "{}"); } catch (e) { raw = {}; }
  Object.assign(settings, raw);

  if (!Array.isArray(settings.providers) || settings.providers.length === 0) {
    const legacyKey = (raw.apiKey || "").trim();
    const legacyUrl = (raw.upstreamUrl || "").trim();
    const legacyModel = (raw.model || "claude-opus-4-7").trim();
    settings.providers = [{
      id: newId(),
      name: "默认",
      url: legacyUrl || "https://cheaprouter.org/v1/messages?beta=true",
      apiKey: legacyKey,
      models: legacyModel ? [legacyModel, "claude-sonnet-4-6"] : ["claude-opus-4-7", "claude-sonnet-4-6"],
    }];
    settings.activeProvider = settings.providers[0].id;
    settings.activeModel = settings.providers[0].models[0];
  }
  ensureValidSelections();

  try { conversations = JSON.parse(localStorage.getItem(SK.convs) || "[]"); } catch (e) { conversations = []; }
  for (const c of conversations) {
    if (!c.mode) c.mode = "single";
    for (const m of c.messages || []) {
      if (m.side === undefined) m.side = null;
    }
  }

  activeId = localStorage.getItem(SK.active);
  if (!conversations.length) {
    activeId = createConversation().id;
  } else if (!conversations.find((c) => c.id === activeId)) {
    activeId = conversations[0].id;
  }
}

function saveSettings() { localStorage.setItem(SK.settings, JSON.stringify(settings)); }
function saveConvs() { localStorage.setItem(SK.convs, JSON.stringify(conversations)); }
function saveActive() { localStorage.setItem(SK.active, activeId || ""); }

// ─── Conversation model ──────────────────────────────────────────────────────
function createConversation() {
  const c = {
    id: newId(),
    title: "新对话",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    systemPrompt: "",
    mode: "single",
  };
  draftConv = c;
  return c;
}

function commitDraft() {
  if (!draftConv) return;
  conversations.unshift(draftConv);
  draftConv = null;
  saveConvs();
  renderConvList();
}

function getActive() {
  if (draftConv && draftConv.id === activeId) return draftConv;
  return conversations.find((c) => c.id === activeId);
}

function setActive(id) {
  if (draftConv && id !== draftConv.id) draftConv = null;
  activeId = id;
  saveActive();
  renderAll();
}

function deleteConversation(id) {
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx < 0) return;
  conversations.splice(idx, 1);
  if (activeId === id) {
    activeId = (conversations[0] && conversations[0].id) || null;
    if (!activeId) activeId = createConversation().id;
  }
  saveConvs(); saveActive();
  renderAll();
}

function renameConversation(id, title) {
  const c = getActive()?.id === id ? getActive() : conversations.find((x) => x.id === id);
  if (!c) return;
  c.title = title.trim() || "未命名";
  c.updatedAt = Date.now();
  if (!draftConv || draftConv.id !== id) saveConvs();
  renderConvList();
  renderHeader();
}

function autoTitle(c) {
  if (c.title && c.title !== "新对话") return;
  const firstUser = c.messages.find((m) => m.role === "user");
  if (firstUser && firstUser.content) {
    c.title = firstUser.content.slice(0, 30).replace(/\s+/g, " ") + (firstUser.content.length > 30 ? "…" : "");
  }
}

function touchActive() {
  const c = getActive();
  if (!c) return;
  c.updatedAt = Date.now();
  autoTitle(c);
  saveConvs();
}

// ─── Render: conv list ───────────────────────────────────────────────────────
function renderConvList() {
  els.convList.innerHTML = "";
  const q = searchQuery.trim().toLowerCase();
  const list = conversations.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  let visible;
  if (q) {
    visible = [];
    for (const c of list) {
      const titleHit = c.title.toLowerCase().includes(q);
      let snippet = null;
      if (!titleHit) {
        for (const m of c.messages) {
          const idx = (m.content || "").toLowerCase().indexOf(q);
          if (idx >= 0) {
            const start = Math.max(0, idx - 18);
            snippet = (start > 0 ? "…" : "") + m.content.slice(start, idx + q.length + 30);
            break;
          }
        }
        if (!snippet) continue;
      }
      visible.push({ conv: c, snippet });
    }
  } else {
    visible = list.map((c) => ({ conv: c, snippet: null }));
  }

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "conv-empty";
    empty.textContent = q ? "未找到匹配的对话" : "还没有对话";
    els.convList.appendChild(empty);
    return;
  }

  for (const { conv, snippet } of visible) {
    const el = document.createElement("div");
    el.className = "conv-item" + (conv.id === activeId ? " active" : "");
    el.onclick = (e) => {
      if (e.target.closest(".conv-menu-btn")) return;
      setActive(conv.id);
    };

    const title = document.createElement("div");
    title.className = "conv-title";
    title.innerHTML = q ? highlightHtml(conv.title, q) : escapeHtml(conv.title);
    el.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "conv-sub";
    const modeBadge = conv.mode === "dual" ? "双 · " : "";
    sub.textContent = `${modeBadge}${conv.messages.length} 条 · ${fmtTime(conv.updatedAt)}`;
    el.appendChild(sub);

    if (snippet) {
      const sn = document.createElement("div");
      sn.className = "conv-snippet";
      sn.innerHTML = highlightHtml(snippet, q);
      el.appendChild(sn);
    }

    const menu = document.createElement("button");
    menu.className = "conv-menu-btn";
    menu.title = "更多";
    menu.innerHTML = ICON.more;
    menu.onclick = (e) => { e.stopPropagation(); openConvMenu(conv, menu); };
    el.appendChild(menu);

    els.convList.appendChild(el);
  }
}

function highlightHtml(text, q) {
  const safe = escapeHtml(text);
  if (!q) return safe;
  const lo = safe.toLowerCase();
  const ql = q.toLowerCase();
  let out = "", i = 0;
  while (i < safe.length) {
    const idx = lo.indexOf(ql, i);
    if (idx < 0) { out += safe.slice(i); break; }
    out += safe.slice(i, idx) + "<mark>" + safe.slice(idx, idx + q.length) + "</mark>";
    i = idx + q.length;
  }
  return out;
}

function openConvMenu(conv, anchor) {
  closePopover();
  const pop = document.createElement("div");
  pop.className = "popover glass";
  pop.style.cssText = "position:fixed;z-index:60;border-radius:10px;padding:6px;min-width:140px;box-shadow:var(--shadow-2);";
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.min(r.left, window.innerWidth - 160) + "px";
  pop.style.top = (r.bottom + 4) + "px";

  const items = [
    { label: "重命名", action: () => promptRename(conv) },
    { label: "复制", action: () => duplicateConv(conv) },
    { label: "删除", action: () => confirmDelete(conv), danger: true },
  ];
  for (const it of items) {
    const b = document.createElement("button");
    b.style.cssText = "display:block;width:100%;text-align:left;background:transparent;border:none;padding:7px 10px;border-radius:6px;font-size:13px;color:" + (it.danger ? "var(--danger)" : "var(--ink)");
    b.textContent = it.label;
    b.onmouseover = () => b.style.background = it.danger ? "var(--danger-soft)" : "rgba(255,255,255,0.7)";
    b.onmouseout = () => b.style.background = "transparent";
    b.onclick = () => { closePopover(); it.action(); };
    pop.appendChild(b);
  }
  document.body.appendChild(pop);
  setTimeout(() => document.addEventListener("click", closePopover, { once: true }), 0);
}
function closePopover() { document.querySelectorAll(".popover").forEach((p) => p.remove()); }

function openSidebarMenu() {
  closePopover();
  const pop = document.createElement("div");
  pop.className = "popover glass";
  pop.style.cssText = "position:fixed;z-index:60;border-radius:10px;padding:6px;min-width:160px;box-shadow:var(--shadow-2);";
  const r = els.menuBtn.getBoundingClientRect();
  pop.style.left = r.left + "px";
  pop.style.top = (r.top - 8) + "px";
  pop.style.transform = "translateY(-100%)";

  const items = [
    { label: "设置", icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', action: openSettings },
    { label: "个性化", icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>', action: openBg },
    { label: "服务", icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>', action: openPower, danger: true },
  ];
  for (const it of items) {
    const b = document.createElement("button");
    b.style.cssText = "display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:transparent;border:none;padding:8px 10px;border-radius:6px;font-size:13px;color:" + (it.danger ? "var(--danger)" : "var(--ink)") + ";cursor:pointer;";
    b.innerHTML = it.icon + "<span>" + it.label + "</span>";
    b.onmouseover = () => b.style.background = it.danger ? "var(--danger-soft)" : "rgba(255,255,255,0.7)";
    b.onmouseout = () => b.style.background = "transparent";
    b.onclick = () => { closePopover(); it.action(); };
    pop.appendChild(b);
  }
  document.body.appendChild(pop);
  setTimeout(() => document.addEventListener("click", closePopover, { once: true }), 0);
}

function promptRename(conv) {
  if (conv.id === activeId) {
    startInlineTitleEdit();
    return;
  }
  showPromptDialog({
    title: "重命名对话",
    value: conv.title,
    onSave: (val) => renameConversation(conv.id, val),
  });
}
function duplicateConv(conv) {
  const copy = JSON.parse(JSON.stringify(conv));
  copy.id = newId();
  copy.title = conv.title + " 副本";
  copy.createdAt = Date.now(); copy.updatedAt = Date.now();
  conversations.unshift(copy);
  saveConvs();
  setActive(copy.id);
}
function confirmDelete(conv) {
  showConfirmDialog({
    title: "删除对话",
    message: `确认删除 "${conv.title}"？此操作不可撤销。`,
    danger: true,
    okText: "删除",
    onOk: () => { deleteConversation(conv.id); showToast("已删除"); },
  });
}

// ─── Custom dialogs (主题配色) ──────────────────────────────────────────────
function showConfirmDialog({ title = "确认", message, danger = false, okText = "确定", cancelText = "取消", onOk }) {
  openModal("confirmTpl", (card) => {
    card.querySelector(".dialog-title").textContent = title;
    card.querySelector(".dialog-message").textContent = message;
    const ok = card.querySelector(".dialog-ok");
    ok.textContent = okText;
    ok.classList.toggle("primary", !danger);
    ok.classList.toggle("danger", danger);
    const cancel = card.querySelector(".dialog-cancel");
    cancel.textContent = cancelText;
    cancel.onclick = closeModal;
    ok.onclick = () => { closeModal(); if (onOk) onOk(); };
    setTimeout(() => ok.focus(), 0);
  });
}

function showPromptDialog({ title = "输入", message = "", value = "", okText = "确定", onSave }) {
  openModal("confirmTpl", (card) => {
    card.querySelector(".dialog-title").textContent = title;
    const msg = card.querySelector(".dialog-message");
    msg.innerHTML = "";
    if (message) {
      const p = document.createElement("div");
      p.style.cssText = "margin-bottom:8px;color:var(--ink-soft);font-size:13px;";
      p.textContent = message;
      msg.appendChild(p);
    }
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.className = "dialog-input";
    msg.appendChild(input);
    const ok = card.querySelector(".dialog-ok");
    ok.textContent = okText;
    const cancel = card.querySelector(".dialog-cancel");
    cancel.onclick = closeModal;
    const submit = () => {
      const v = input.value;
      closeModal();
      if (onSave) onSave(v);
    };
    ok.onclick = submit;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
      if (e.key === "Escape") { e.preventDefault(); closeModal(); }
    });
    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}

function startInlineTitleEdit() {
  const c = getActive(); if (!c) return;
  const btn = els.renameTitleBtn;
  const input = $("titleInput");
  if (!input) return;
  input.value = c.title;
  btn.hidden = true;
  input.hidden = false;
  input.focus();
  input.select();
  let done = false;
  const finish = (commit) => {
    if (done) return; done = true;
    if (commit) {
      const v = input.value.trim();
      if (v && v !== c.title) renameConversation(c.id, v);
    }
    input.hidden = true;
    btn.hidden = false;
    input.removeEventListener("blur", onBlur);
    input.removeEventListener("keydown", onKey);
  };
  const onBlur = () => finish(true);
  const onKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
  };
  input.addEventListener("blur", onBlur);
  input.addEventListener("keydown", onKey);
}

// ─── Render: header ──────────────────────────────────────────────────────────
function renderHeader() {
  const c = getActive();
  if (!c) return;
  els.convTitle.textContent = c.title;
  const chars = c.messages.reduce((n, m) => n + (m.content || "").length, 0);
  const charsTxt = chars > 9999 ? (chars / 1000).toFixed(1) + "k" : chars;
  els.convStat.textContent = `${c.messages.length} 条消息 · ${charsTxt} 字符`;

  els.modeSegment.querySelectorAll(".mode-seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === c.mode);
    b.disabled = c.messages.length > 0;
    b.title = c.messages.length > 0 ? "已有消息的对话不能切换模式" : "";
  });

  renderModelPickers(c);
}

function renderModelPickers(c) {
  const root = els.modelPickers;
  root.innerHTML = "";
  if (c.mode === "dual") {
    root.appendChild(buildPickerGroup("A", settings.providerA, settings.modelA, (pid, m) => {
      settings.providerA = pid; settings.modelA = m; saveSettings();
      renderMessages();
    }));
    root.appendChild(buildPickerGroup("B", settings.providerB, settings.modelB, (pid, m) => {
      settings.providerB = pid; settings.modelB = m; saveSettings();
      renderMessages();
    }));
  } else {
    root.appendChild(buildPickerGroup(null, settings.activeProvider, settings.activeModel, (pid, m) => {
      settings.activeProvider = pid; settings.activeModel = m; saveSettings();
    }));
  }
}

function buildPickerGroup(tag, currentProv, currentModel, onChange) {
  const group = document.createElement("div");
  group.className = "picker-group";
  if (tag) {
    const t = document.createElement("span");
    t.className = "picker-tag";
    t.textContent = tag;
    group.appendChild(t);
  }
  const provSel = document.createElement("select");
  provSel.className = "picker-select";
  provSel.title = "提供商";
  for (const p of settings.providers) {
    const opt = document.createElement("option");
    opt.value = p.id; opt.textContent = p.name;
    if (p.id === currentProv) opt.selected = true;
    provSel.appendChild(opt);
  }
  if (!settings.providers.length) {
    const opt = document.createElement("option");
    opt.value = ""; opt.textContent = "（无提供商）";
    provSel.appendChild(opt);
    provSel.disabled = true;
  }

  const sep = document.createElement("span");
  sep.className = "picker-divider";
  sep.textContent = "/";

  const modelSel = document.createElement("select");
  modelSel.className = "picker-select";
  modelSel.title = "模型";

  const fillModels = (pid, selected) => {
    modelSel.innerHTML = "";
    const p = getProvider(pid);
    const models = (p && p.models) || [];
    if (!models.length) {
      const opt = document.createElement("option");
      opt.value = ""; opt.textContent = "（无模型）";
      modelSel.appendChild(opt);
      modelSel.disabled = true;
      return;
    }
    modelSel.disabled = false;
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m; opt.textContent = m;
      if (m === selected) opt.selected = true;
      modelSel.appendChild(opt);
    }
    if (!modelSel.value && modelSel.options.length) modelSel.selectedIndex = 0;
  };
  fillModels(currentProv, currentModel);

  provSel.onchange = () => {
    fillModels(provSel.value, null);
    onChange(provSel.value, modelSel.value);
  };
  modelSel.onchange = () => onChange(provSel.value, modelSel.value);

  group.appendChild(provSel);
  group.appendChild(sep);
  group.appendChild(modelSel);
  return group;
}

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
    for (const m of c.messages) els.messages.appendChild(renderMessage(m));
  }
  scrollToBottom();
}

function renderMessagesDual(c) {
  let i = 0;
  while (i < c.messages.length) {
    const m = c.messages[i];
    if (m.role === "user") {
      els.messages.appendChild(renderMessage(m));
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
    els.messages.appendChild(renderDualRow(sideA, sideB));
    i = Math.max(j, i + 1);
  }
}

function renderDualRow(sideA, sideB) {
  const row = document.createElement("div");
  row.className = "msg-row-dual";
  row.appendChild(renderDualColumn("A", sideA));
  row.appendChild(renderDualColumn("B", sideB));
  return row;
}

function renderDualColumn(side, msg) {
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
    col.appendChild(renderMessage(msg));
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

function renderMessage(m) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + m.role;
  wrap.dataset.id = m.id;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = m.role === "user" ? "你" : m.role === "assistant" ? "C" : "!";
  wrap.appendChild(avatar);

  const body = document.createElement("div");
  body.className = "msg-body";

  const meta = document.createElement("div");
  meta.className = "msg-meta";
  const role = document.createElement("span");
  role.className = "msg-role";
  role.textContent = { user: "You", assistant: "Claude", error: "Error" }[m.role] || m.role;
  meta.appendChild(role);
  body.appendChild(meta);

  if (m.thinking) body.appendChild(renderThinking(m.thinking));
  if (m.tools && m.tools.length) {
    for (const t of m.tools) body.appendChild(renderToolCard(t));
  }
  if (m.attachments && m.attachments.length) body.appendChild(renderMsgAttachments(m.attachments));

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
  actions.appendChild(makeIconBtn(ICON.trash, "删除", () => deleteMessage(m.id)));
  body.appendChild(actions);

  wrap.appendChild(body);
  return wrap;
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

function renderMsgAttachments(atts) {
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
    if (a.kind === "pdf" && a.data) {
      el.classList.add("clickable");
      el.onclick = () => openPdfViewer(a);
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

// ─── Message ops ─────────────────────────────────────────────────────────────
function pushMessage(role, content, extra = {}) {
  const c = getActive(); if (!c) return null;
  if (draftConv && draftConv.id === c.id) commitDraft();
  const m = { id: newId(), role, content, ts: Date.now(), side: null, ...extra };
  c.messages.push(m);
  touchActive();
  renderMessages(); renderHeader(); renderConvList();
  return m;
}

function deleteMessage(id) {
  const c = getActive(); if (!c) return;
  c.messages = c.messages.filter((m) => m.id !== id);
  touchActive(); renderAll();
}

function startEdit(id) {
  const c = getActive(); if (!c) return;
  const m = c.messages.find((x) => x.id === id); if (!m) return;
  const wrap = els.messages.querySelector(`.msg[data-id="${id}"]`); if (!wrap) return;
  if (wrap.querySelector(".msg-edit")) return;
  const body = wrap.querySelector(".msg-body");
  const content = body.querySelector(".msg-content");
  content.style.display = "none";

  const ta = document.createElement("textarea");
  ta.className = "msg-edit"; ta.value = m.content;
  body.appendChild(ta);
  autoGrow(ta);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);

  const actions = document.createElement("div");
  actions.className = "msg-edit-actions";
  const save = document.createElement("button");
  save.className = "primary"; save.textContent = "保存";
  save.onclick = () => { m.content = ta.value; touchActive(); renderAll(); };
  const cancel = document.createElement("button");
  cancel.className = "ghost"; cancel.textContent = "取消";
  cancel.onclick = () => renderMessages();
  actions.appendChild(save); actions.appendChild(cancel);
  body.appendChild(actions);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); renderMessages(); }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save.click(); }
  });
  ta.addEventListener("input", () => autoGrow(ta));
}

function resendFrom(id) {
  const c = getActive(); if (!c) return;
  const idx = c.messages.findIndex((m) => m.id === id);
  if (idx < 0) return;
  c.messages = c.messages.slice(0, idx + 1);
  touchActive(); renderAll();
  streamReply();
}

function regenerateAt(id) {
  const c = getActive(); if (!c) return;
  const m = c.messages.find((x) => x.id === id);
  if (!m) return;
  const idx = c.messages.indexOf(m);
  c.messages.splice(idx, 1);
  touchActive(); renderAll();
  if (c.mode === "dual" && (m.side === "A" || m.side === "B")) {
    streamReplyOneSide(m.side);
  } else {
    streamReply();
  }
}

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

async function streamReplyOneSide(side) {
  const c = getActive(); if (!c) return;
  if (settings.webSearchEnabled && (!settings.searchUrl || !settings.searchKey)) {
    showToast("已启用联网搜索，请在设置里填写搜索 URL 和 Key", "error");
    openSettings();
    return;
  }
  const sel = preflightCheck(side);
  if (!sel) return;
  const placeholder = pushMessage("assistant", "", { streaming: true, thinking: "", tools: [], side, providerName: sel.provider.name, model: sel.model });
  setBusy(true);
  currentAbort = new AbortController();
  try {
    await runOneStream(sel.provider, sel.model, side, placeholder, currentAbort.signal);
  } finally {
    setBusy(false); currentAbort = null;
  }
}

function buildMessagesForSide(c, placeholderId, side) {
  return c.messages
    .filter((m) => m.id !== placeholderId)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.role === "user" || m.side === side)
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

// ─── Modal ───────────────────────────────────────────────────────────────────
function openModal(tplId, onMount) {
  closeModal();
  const tpl = document.getElementById(tplId);
  const card = tpl.content.firstElementChild.cloneNode(true);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  card.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
  els.modalRoot.appendChild(overlay);
  document.addEventListener("keydown", escClose);
  if (onMount) onMount(card);
}
function closeModal() {
  els.modalRoot.innerHTML = "";
  document.removeEventListener("keydown", escClose);
}
function escClose(e) { if (e.key === "Escape") closeModal(); }

// ─── Settings UI ─────────────────────────────────────────────────────────────
function openSettings() {
  openModal("settingsTpl", (card) => {
    renderProvidersList(card);

    fillModelSelect(card.querySelector("#m_activeProvider"), card.querySelector("#m_activeModel"), settings.activeProvider, settings.activeModel);
    fillModelSelect(card.querySelector("#m_providerA"), card.querySelector("#m_modelA"), settings.providerA, settings.modelA);
    fillModelSelect(card.querySelector("#m_providerB"), card.querySelector("#m_modelB"), settings.providerB, settings.modelB);

    card.querySelector("#m_searchUrl").value = settings.searchUrl;
    card.querySelector("#m_searchKey").value = settings.searchKey;
    card.querySelector("#m_effort").value = settings.effort;
    card.querySelector("#m_maxTokens").value = settings.maxTokens;
    card.querySelector("#m_system").value = settings.systemPrompt;

    card.querySelector("#m_addProvider").onclick = () => {
      settings.providers.push({
        id: newId(), name: "新提供商",
        url: "", apiKey: "", models: [],
      });
      saveSettings();
      renderProvidersList(card);
      refreshSelects(card);
    };

    card.querySelector("#m_save").onclick = () => {
      settings.activeProvider = card.querySelector("#m_activeProvider").value;
      settings.activeModel = card.querySelector("#m_activeModel").value;
      settings.providerA = card.querySelector("#m_providerA").value;
      settings.modelA = card.querySelector("#m_modelA").value;
      settings.providerB = card.querySelector("#m_providerB").value;
      settings.modelB = card.querySelector("#m_modelB").value;
      settings.searchUrl = card.querySelector("#m_searchUrl").value.trim();
      settings.searchKey = card.querySelector("#m_searchKey").value.trim();
      settings.effort = card.querySelector("#m_effort").value;
      settings.maxTokens = parseInt(card.querySelector("#m_maxTokens").value, 10) || 64000;
      settings.systemPrompt = card.querySelector("#m_system").value;
      ensureValidSelections();
      saveSettings();
      updateWebSearchUI();
      renderHeader();
      showToast("设置已保存");
      closeModal();
    };
    card.querySelector("#m_export").onclick = exportAll;
    card.querySelector("#m_import").onclick = () => card.querySelector("#m_importFile").click();
    card.querySelector("#m_importFile").onchange = (e) => importAll(e.target.files[0]);
    card.querySelector("#m_clearAll").onclick = () => {
      showConfirmDialog({
        title: "清空全部对话",
        message: "确认清空所有对话？此操作不可撤销。",
        danger: true,
        okText: "清空",
        onOk: () => {
          conversations = [];
          activeId = createConversation().id;
          saveConvs(); saveActive();
          renderAll(); closeModal();
          showToast("已清空");
        },
      });
    };
  });
}

function renderProvidersList(card) {
  const list = card.querySelector("#m_providersList");
  list.innerHTML = "";
  if (!settings.providers.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "暂无提供商，点击下方添加";
    list.appendChild(empty);
    return;
  }
  for (const p of settings.providers) {
    const row = document.createElement("div");
    row.className = "provider-row";

    const head = document.createElement("div");
    head.className = "provider-row-head";
    head.innerHTML = `
      <span class="provider-name">${escapeHtml(p.name || "未命名")}</span>
      <span class="provider-meta">${(p.models || []).length} 模型 · ${p.apiKey ? "已配 Key" : "未配 Key"}</span>
      <span class="provider-toggle">▸</span>
    `;
    const detail = document.createElement("div");
    detail.className = "provider-row-detail";
    detail.innerHTML = `
      <label class="field"><span>名称</span><input type="text" data-f="name" value="${escapeHtml(p.name || "")}"></label>
      <label class="field"><span>API URL</span><input type="text" data-f="url" value="${escapeHtml(p.url || "")}"></label>
      <label class="field"><span>API Key</span><input type="password" data-f="apiKey" value="${escapeHtml(p.apiKey || "")}"></label>
      <label class="field"><span>模型列表（逗号或换行分隔）</span><textarea data-f="models" rows="3">${escapeHtml((p.models || []).join("\n"))}</textarea></label>
      <div class="btn-row">
        <button class="ghost provider-save">保存</button>
        <button class="danger provider-delete">删除提供商</button>
      </div>
    `;
    row.appendChild(head);
    row.appendChild(detail);

    head.onclick = () => row.classList.toggle("open");

    detail.querySelector(".provider-save").onclick = (e) => {
      e.stopPropagation();
      const get = (f) => detail.querySelector(`[data-f="${f}"]`).value;
      p.name = get("name").trim() || "未命名";
      p.url = get("url").trim();
      p.apiKey = get("apiKey").trim();
      p.models = get("models").split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
      ensureValidSelections();
      saveSettings();
      renderProvidersList(card);
      refreshSelects(card);
      showToast(`已保存 ${p.name}`);
    };
    detail.querySelector(".provider-delete").onclick = (e) => {
      e.stopPropagation();
      showConfirmDialog({
        title: "删除提供商",
        message: `确认删除 "${p.name}"？此操作不可撤销。`,
        danger: true,
        okText: "删除",
        onOk: () => {
          settings.providers = settings.providers.filter((x) => x.id !== p.id);
          ensureValidSelections();
          saveSettings();
          renderProvidersList(card);
          refreshSelects(card);
        },
      });
    };

    list.appendChild(row);
  }
}

function fillModelSelect(provSel, modelSel, currentProv, currentModel) {
  provSel.innerHTML = "";
  for (const p of settings.providers) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === currentProv) opt.selected = true;
    provSel.appendChild(opt);
  }
  const refreshModels = () => {
    const p = getProvider(provSel.value);
    modelSel.innerHTML = "";
    for (const m of (p && p.models) || []) {
      const opt = document.createElement("option");
      opt.value = m; opt.textContent = m;
      if (m === currentModel && p && p.id === currentProv) opt.selected = true;
      modelSel.appendChild(opt);
    }
    if (!modelSel.value && modelSel.options.length) modelSel.selectedIndex = 0;
  };
  refreshModels();
  provSel.onchange = refreshModels;
}

function refreshSelects(card) {
  fillModelSelect(card.querySelector("#m_activeProvider"), card.querySelector("#m_activeModel"), settings.activeProvider, settings.activeModel);
  fillModelSelect(card.querySelector("#m_providerA"), card.querySelector("#m_modelA"), settings.providerA, settings.modelA);
  fillModelSelect(card.querySelector("#m_providerB"), card.querySelector("#m_modelB"), settings.providerB, settings.modelB);
}

// ─── Background ──────────────────────────────────────────────────────────────
function openBg() {
  openModal("bgTpl", (card) => {
    const grid = card.querySelector("#bgGrid");
    const cur = localStorage.getItem(SK.bg) || "warm-cream";
    const customSrc = localStorage.getItem(SK.bgCustom);

    const all = PRESETS.slice();
    if (customSrc) all.push({ id: "custom", name: "自定义", img: customSrc });

    for (const p of all) {
      const card2 = document.createElement("div");
      card2.className = "bg-card" + (cur === p.id ? " active" : "");
      card2.style.background = p.img ? `center/cover url(${p.img})` : p.css;
      const name = document.createElement("div");
      name.className = "bg-name"; name.textContent = p.name;
      card2.appendChild(name);
      card2.onclick = () => {
        applyBg(p.id);
        grid.querySelectorAll(".bg-card").forEach((c) => c.classList.remove("active"));
        card2.classList.add("active");
      };
      grid.appendChild(card2);
    }

    card.querySelector("#bgUpload").onclick = () => card.querySelector("#bgFile").click();
    card.querySelector("#bgFile").onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 4 * 1024 * 1024) { showToast("图片过大（最大 4MB）", "error"); return; }
      const fr = new FileReader();
      fr.onload = () => {
        localStorage.setItem(SK.bgCustom, fr.result);
        applyBg("custom");
        closeModal(); openBg();
      };
      fr.readAsDataURL(f);
    };

    const op = card.querySelector("#opacity");
    const opVal = card.querySelector("#opVal");
    const cur2 = parseInt(localStorage.getItem(SK.opacity) || "70", 10);
    op.value = cur2; opVal.textContent = cur2 + "%";
    op.oninput = () => {
      opVal.textContent = op.value + "%";
      applyOpacity(parseInt(op.value, 10));
      localStorage.setItem(SK.opacity, op.value);
    };
  });
}

function applyBg(id) {
  localStorage.setItem(SK.bg, id);
  if (id === "custom") {
    const src = localStorage.getItem(SK.bgCustom);
    if (src) {
      els.bgLayer.style.backgroundImage = `url(${src})`;
      els.bgLayer.style.background = `center/cover no-repeat url(${src})`;
    }
    return;
  }
  const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
  els.bgLayer.style.background = p.css;
  els.bgLayer.style.backgroundSize = "cover";
}
function applyOpacity(pct) {
  document.documentElement.style.setProperty("--glass-alpha", (pct / 100).toFixed(2));
}

// ─── Export / Import ─────────────────────────────────────────────────────────
function exportAll() {
  const sanitized = JSON.parse(JSON.stringify(settings));
  for (const p of sanitized.providers || []) p.apiKey = "";
  sanitized.searchKey = "";
  const blob = new Blob([JSON.stringify({ settings: sanitized, conversations }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `chatui-${Date.now()}.json`;
  a.click();
  showToast("已导出");
}

async function importAll(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.settings) {
      Object.assign(settings, data.settings);
      ensureValidSelections();
      saveSettings();
    }
    if (Array.isArray(data.conversations)) {
      conversations = data.conversations;
      for (const c of conversations) {
        if (!c.mode) c.mode = "single";
        for (const m of c.messages || []) if (m.side === undefined) m.side = null;
      }
      activeId = conversations[0]?.id;
      if (!activeId) activeId = createConversation().id;
      saveConvs(); saveActive();
    } else if (Array.isArray(data.messages)) {
      const c = createConversation();
      c.messages = data.messages;
      c.systemPrompt = data.system || "";
      activeId = c.id; commitDraft(); saveActive();
    }
    renderAll();
    closeModal();
    showToast("已导入");
  } catch (err) { showToast("导入失败: " + err.message, "error"); }
}

// ─── Mode toggle ─────────────────────────────────────────────────────────────
function setMode(mode) {
  const c = getActive(); if (!c) return;
  if (c.messages.length > 0) {
    showToast("已有消息的对话不能切换模式，请新建对话");
    return;
  }
  c.mode = mode;
  saveConvs();
  renderAll();
}

// ─── Web search UI ───────────────────────────────────────────────────────────
function updateWebSearchUI() {
  const btn = els.webSearchBtn;
  if (settings.webSearchEnabled) {
    btn.classList.add("active");
    btn.title = "联网搜索已启用";
  } else {
    btn.classList.remove("active");
    btn.title = "启用联网搜索";
  }
}

// ─── Power ───────────────────────────────────────────────────────────────────
function openPower() {
  openModal("powerTpl", (card) => {
    card.querySelector("#m_restart").onclick = () => {
      showConfirmDialog({
        title: "重启服务",
        message: "确认重启 chatui 后端服务？当前请求会被中断。",
        okText: "重启",
        onOk: () => sendPower("/api/system/restart", "重启"),
      });
    };
    card.querySelector("#m_shutdown").onclick = () => {
      showConfirmDialog({
        title: "关闭服务",
        message: "确认关闭 chatui 后端服务？需要在终端重新启动。",
        danger: true,
        okText: "关闭",
        onOk: () => sendPower("/api/system/shutdown", "关闭"),
      });
    };
  });
}

async function sendPower(url, label) {
  try {
    const r = await fetch(url, { method: "POST" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    closeModal();
    showToast(`${label}指令已发送`);
    if (label === "重启") setTimeout(() => waitForServer(), 800);
    else setTimeout(() => showToast("服务已关闭", "error"), 800);
  } catch (e) {
    showToast(`${label}失败: ${e.message}`, "error");
  }
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch("/", { cache: "no-store" });
      if (r.ok) { showToast("服务已重启"); return; }
    } catch (e) {}
    await new Promise((res) => setTimeout(res, 600));
  }
  showToast("等待服务重启超时", "error");
}

// ─── Events ──────────────────────────────────────────────────────────────────
els.newChatBtn.onclick = () => {
  const c = createConversation();
  setActive(c.id);
  els.input.focus();
};
els.searchInput.oninput = (e) => {
  searchQuery = e.target.value;
  els.searchClear.hidden = !searchQuery;
  renderConvList();
};
els.searchClear.onclick = () => {
  els.searchInput.value = ""; searchQuery = "";
  els.searchClear.hidden = true; renderConvList();
  els.searchInput.focus();
};
els.menuBtn.onclick = openSidebarMenu;
els.attachBtn.onclick = () => els.attachFile.click();
els.attachFile.onchange = async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  for (const f of files) await uploadFile(f);
};
els.renameTitleBtn.onclick = () => {
  const c = getActive(); if (!c) return;
  promptRename(c);
};
els.modeSegment.addEventListener("click", (e) => {
  const btn = e.target.closest(".mode-seg-btn");
  if (!btn || btn.disabled) return;
  setMode(btn.dataset.mode);
});

els.sendBtn.onclick = send;
els.stopBtn.onclick = () => { if (currentAbort) currentAbort.abort(); };

els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
});
els.input.addEventListener("input", () => autoGrow(els.input));

els.messages.addEventListener("scroll", () => {
  const m = els.messages;
  scrollPinned = m.scrollHeight - m.scrollTop - m.clientHeight < 80;
});

els.sidebarToggle.onclick = () => els.sidebar.classList.toggle("collapsed");

els.webSearchBtn.onclick = () => {
  if (!settings.webSearchEnabled && (!settings.searchUrl || !settings.searchKey)) {
    showToast("请先在设置里填写搜索 URL 和 Key", "error");
    openSettings();
    return;
  }
  settings.webSearchEnabled = !settings.webSearchEnabled;
  saveSettings();
  updateWebSearchUI();
  showToast(settings.webSearchEnabled ? "已启用联网搜索" : "已关闭联网搜索");
};

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault(); els.searchInput.focus(); els.searchInput.select();
  }
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
    e.preventDefault(); els.newChatBtn.click();
  }
});

// ─── Init ────────────────────────────────────────────────────────────────────
loadAll();
applyBg(localStorage.getItem(SK.bg) || "warm-cream");
applyOpacity(parseInt(localStorage.getItem(SK.opacity) || "70", 10));
renderAll();
autoGrow(els.input);
updateWebSearchUI();
els.input.focus();
