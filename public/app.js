const itemsEl = document.querySelector("#items");
const template = document.querySelector("#itemTemplate");
const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const copyUrl = document.querySelector("#copyUrl");
const inboxPath = document.querySelector("#inboxPath");
const textPanel = document.querySelector("#textPanel");
const textInput = document.querySelector("#textInput");
const pasteText = document.querySelector("#pasteText");
const sendText = document.querySelector("#sendText");
const cancelText = document.querySelector("#cancelText");
const statusEl = document.querySelector("#status");
const serviceStatus = document.querySelector("#serviceStatus");
const recommendedUrl = document.querySelector("#recommendedUrl");
const addressList = document.querySelector("#addressList");
const accessCodeValue = document.querySelector("#accessCodeValue");
const copyAccessCode = document.querySelector("#copyAccessCode");
const refreshAccessCode = document.querySelector("#refreshAccessCode");
const networkName = document.querySelector("#networkName");
const versionBadge = document.querySelector("#versionBadge");
const qrCode = document.querySelector("#qrCode");
const queuePanel = document.querySelector("#queuePanel");
const queueList = document.querySelector("#queueList");
const queueSummary = document.querySelector("#queueSummary");
const searchInput = document.querySelector("#searchInput");
const typeFilter = document.querySelector("#typeFilter");
const devicesPanel = document.querySelector("#devicesPanel");
const devicesList = document.querySelector("#devicesList");
const refreshDevices = document.querySelector("#refreshDevices");
const clearOfflineDevices = document.querySelector("#clearOfflineDevices");
const clipboardPanel = document.querySelector("#clipboardPanel");
const toggleClipboardPanel = document.querySelector("#toggleClipboardPanel");
const clipboardInput = document.querySelector("#clipboardInput");
const readClipboard = document.querySelector("#readClipboard");
const sendClipboard = document.querySelector("#sendClipboard");
const clearClipboard = document.querySelector("#clearClipboard");
const clipboardHint = document.querySelector("#clipboardHint");
const updatePanel = document.querySelector("#updatePanel");
const updateSummary = document.querySelector("#updateSummary");
const checkUpdate = document.querySelector("#checkUpdate");
const updateActions = document.querySelector("#updateActions");
const backupPanel = document.querySelector("#backupPanel");
const exportBackup = document.querySelector("#exportBackup");
const importBackupInput = document.querySelector("#importBackupInput");
const createLocalBackup = document.querySelector("#createLocalBackup");
const openBackupPath = document.querySelector("#openBackupPath");
const localBackupSummary = document.querySelector("#localBackupSummary");
const localBackupList = document.querySelector("#localBackupList");
const accessCodeMeta = document.querySelector("#accessCodeMeta");
const viewButtons = [...document.querySelectorAll("[data-view-target]")];
const views = [...document.querySelectorAll("[data-view]")];
const appWorkspace = document.querySelector(".app-workspace");
const clipboardHistoryPanel = document.querySelector("#clipboardHistoryPanel");
const clipboardHistorySummary = document.querySelector("#clipboardHistorySummary");
const toggleClipboardHistory = document.querySelector("#toggleClipboardHistory");
const clipboardHistory = document.querySelector("#clipboardHistory");
const clearClipboardHistory = document.querySelector("#clearClipboardHistory");
const clearTransferItems = document.querySelector("#clearTransferItems");
const clipboardSyncToggle = document.querySelector("#clipboardSyncToggle");
const settingClipboardSync = document.querySelector("#settingClipboardSync");
const deviceNameInput = document.querySelector("#deviceNameInput");
const securityModeSetting = document.querySelector("#securityModeSetting");
const accessLengthSetting = document.querySelector("#accessLengthSetting");
const settingsInboxPath = document.querySelector("#settingsInboxPath");
const copyInboxPath = document.querySelector("#copyInboxPath");
const openInboxPath = document.querySelector("#openInboxPath");
const openDevicesView = document.querySelector("#openDevicesView");
const yaojiNavLink = document.querySelector("#yaojiNavLink");
const imagePreviewDialog = document.querySelector("#imagePreviewDialog");
const imagePreviewTitle = document.querySelector("#imagePreviewTitle");
const imagePreviewImage = document.querySelector("#imagePreviewImage");
const closeImagePreview = document.querySelector("#closeImagePreview");
const copyPreviewImage = document.querySelector("#copyPreviewImage");
const openPreviewImage = document.querySelector("#openPreviewImage");
const qrPreviewDialog = document.querySelector("#qrPreviewDialog");
const qrPreviewImage = document.querySelector("#qrPreviewImage");
const qrPreviewUrl = document.querySelector("#qrPreviewUrl");
const closeQrPreview = document.querySelector("#closeQrPreview");

function revealYaojiNav() {
  if (yaojiNavLink) yaojiNavLink.hidden = false;
}

if (sessionStorage.getItem("lanDrop.yaojiOpen") === "true") {
  revealYaojiNav();
}

let items = [];
let phoneUrl = location.href;
let phoneUrls = [];
let queue = [];
let isLocalAccess = false;
let currentAccessCode = "";
let devices = [];
let appVersion = "";
let inboxDirectory = "";
let clipboardPollTimer = null;
let updatePollTimer = null;
let lastAutoClipboardText = "";
let lastClipboardPreview = null;
let activePreviewItem = null;
let clipboardPanelExpanded = localStorage.getItem("lanDrop.clipboardPanelExpanded") === "true";
let clipboardHistoryExpanded = false;
const lastClipboardTextKey = "lanDrop.lastClipboardTextFingerprint";

const settings = {
  deviceName: localStorage.getItem("lanDrop.deviceName") || "",
  accessCodeLength: 4,
  clipboardSync: localStorage.getItem("lanDrop.clipboardSync") === "true",
  securityMode: false
};

async function copyText(text, button) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      flashButton(button, "已复制");
      return;
    }
    throw new Error("Clipboard API unavailable");
  } catch {
    const area = document.createElement("textarea");
    area.className = "copy-helper";
    area.value = text;
    area.setAttribute("readonly", "");
    document.body.append(area);
    area.focus();
    area.select();
    const copied = document.execCommand("copy");
    if (copied) {
      area.remove();
      flashButton(button, "已复制");
      return;
    }
    flashButton(button, "已选中");
  }
}

async function copyImage(item, button) {
  try {
    const systemResponse = await fetch("/api/copy-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: item.filename })
    });
    if (systemResponse.ok) {
      flashButton(button, "已复制");
      return;
    }

    if (!navigator.clipboard || !window.ClipboardItem || !window.isSecureContext) {
      throw new Error("Image clipboard unavailable");
    }
    const response = await fetch(authUrl(item.url));
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type || item.mime || "image/png"]: blob
      })
    ]);
    flashButton(button, "已复制");
  } catch {
    flashButton(button, "打开原图");
    setTimeout(() => {
      location.href = authUrl(item.url);
    }, 250);
  }
}

async function copyFile(item, button) {
  try {
    const response = await fetch("/api/copy-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: item.filename })
    });
    if (!response.ok) throw new Error("System file clipboard unavailable");
    flashButton(button, "已复制");
  } catch {
    await copyText(new URL(authUrl(item.url), location.origin).href, button);
  }
}

async function openItem(item) {
  if (isDangerousItem(item)) {
    showStatus("已按安全策略改为下载，请确认来源可信后再打开。", "info");
    window.open(authUrl(item.url), "_blank", "noopener");
    return;
  }
  if (item.type === "file" && (item.mime || "").startsWith("image/")) {
    openImagePreview(item);
    return;
  }
  if (isLocalAccess && item.filename) {
    try {
      const response = await fetch("/api/open-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: item.filename })
      });
      if (!response.ok) throw new Error("open failed");
      showStatus("已打开文件", "ok");
      return;
    } catch {
      showStatus("没有可用程序打开这个文件，已改为新窗口预览/下载", "error");
    }
  }
  window.open(authUrl(item.url), "_blank", "noopener");
}

function openImagePreview(item) {
  if (!imagePreviewDialog || !imagePreviewImage) {
    window.open(authUrl(item.url), "_blank", "noopener");
    return;
  }
  activePreviewItem = item;
  imagePreviewTitle.textContent = item.name || item.filename || "图片预览";
  imagePreviewImage.src = authUrl(item.url);
  imagePreviewImage.alt = item.name || "图片预览";
  if (typeof imagePreviewDialog.showModal === "function") {
    imagePreviewDialog.showModal();
  } else {
    imagePreviewDialog.setAttribute("open", "");
  }
}

function closeImagePreviewDialog() {
  if (!imagePreviewDialog) return;
  if (typeof imagePreviewDialog.close === "function") imagePreviewDialog.close();
  else imagePreviewDialog.removeAttribute("open");
  activePreviewItem = null;
  if (imagePreviewImage) imagePreviewImage.removeAttribute("src");
}

function flashButton(button, text) {
  const original = button.textContent;
  button.textContent = text;
  setTimeout(() => (button.textContent = original), 1200);
}

function flashAction(button, text) {
  if (!button) return;
  flashButton(button, text);
}

function showStatus(message, kind = "info") {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
  if (kind !== "busy") {
    setTimeout(() => {
      statusEl.hidden = true;
    }, 2600);
  }
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value) {
  return new Date(value).toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatRelativeTime(value) {
  if (!value) return "未知";
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  return formatTime(value);
}

function updateAssetLabel(asset) {
  const name = asset?.name || "";
  const platform = /mac/i.test(name) ? "Mac 版" : /win|\.exe$/i.test(name) ? "Windows 版" : "安装包";
  return `${platform}${asset.size ? ` · ${formatSize(asset.size)}` : ""}`;
}

function updateDownloadLabel(asset, platformName = "") {
  const system = platformName || (/mac/i.test(asset?.name || "") ? "Mac" : /win|\.exe$/i.test(asset?.name || "") ? "Windows" : "当前系统");
  return `下载 ${system} 安装包${asset?.size ? ` · ${formatSize(asset.size)}` : ""}`;
}

function formatBackupTime(value) {
  if (!value) return "未知时间";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function authUrl(url) {
  return window.lanDropAccess ? window.lanDropAccess.withAccessUrl(url) : url;
}

function looksLikeUrl(text = "") {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

function isDangerousItem(item) {
  if (item.dangerous) return true;
  const name = String(item.name || item.filename || "");
  return /\.(html?|svg|m?js|cjs|xml|xhtml|bat|cmd|ps1|vbs|wsf|hta|scr|reg|lnk|url|exe|msi|app|command|sh)$/i.test(name);
}

function dangerReason(item) {
  return item.dangerReason || "这类文件可能包含脚本或启动程序，请确认来源可信后再打开。";
}

function normalizeClipboardText(text = "") {
  return String(text).replace(/\r\n/g, "\n").trim();
}

function textFingerprint(text = "") {
  const normalized = normalizeClipboardText(text);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }
  return `${normalized.length}:${hash}`;
}

function hasRecentClipboardText(text) {
  const normalized = normalizeClipboardText(text);
  const tenMinutes = 10 * 60 * 1000;
  return items.some((item) => {
    if (item.type !== "text" || item.source !== "clipboard") return false;
    if (normalizeClipboardText(item.text) !== normalized) return false;
    return Date.now() - new Date(item.createdAt).getTime() < tenMinutes;
  });
}

function resizeClipboardInput() {
  if (!clipboardInput) return;
  clipboardInput.style.height = "auto";
  clipboardInput.style.height = `${Math.min(180, Math.max(64, clipboardInput.scrollHeight))}px`;
}

function setClipboardHint(message, kind = "info") {
  if (!clipboardHint) return;
  clipboardHint.textContent = message;
  clipboardHint.dataset.kind = kind;
}

function clipboardPreviewLabel(clipboard) {
  if (!clipboard || clipboard.type === "empty") return "剪贴板里暂时没有可发送内容。";
  if (clipboard.type === "files") {
    const names = (clipboard.files || []).map((file) => file.name).slice(0, 3).join("、");
    return `检测到电脑剪贴板里的 ${clipboard.count} 个文件${names ? `：${names}` : ""}，点击“同步到互传”后手机可下载。`;
  }
  if (clipboard.type === "image") return "检测到电脑剪贴板图片或截图，点击“同步到互传”后手机可下载。";
  if (clipboard.type === "text") return looksLikeUrl(clipboard.text) ? "检测到链接，可以同步到互传列表。" : "检测到文字，可以同步到互传列表。";
  return "剪贴板里暂时没有可发送内容。";
}

function showView(id) {
  for (const view of views) view.hidden = view.id !== id;
  for (const button of viewButtons) {
    button.classList.toggle("active", button.dataset.viewTarget === id);
  }
  if (id === "devicesView") loadDevices();
}

function resetWorkspaceScroll() {
  if (appWorkspace) appWorkspace.scrollTo({ top: 0, left: 0, behavior: "auto" });
  else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function setClipboardPanelExpanded(expanded, { remember = true } = {}) {
  clipboardPanelExpanded = expanded;
  if (remember) localStorage.setItem("lanDrop.clipboardPanelExpanded", expanded ? "true" : "false");
  clipboardPanel?.classList.toggle("collapsed", !expanded);
  if (toggleClipboardPanel) toggleClipboardPanel.textContent = expanded ? "收起" : "展开";
  clipboardPanel?.classList.toggle("listening", Boolean(settings.clipboardSync));
  if (expanded) resizeClipboardInput();
}

function showInitialView() {
  const id = location.hash.replace("#", "");
  if (["clipboardPanel", "receivedFeed", "dropZone"].includes(id)) {
    showView("transferView");
    if (id === "clipboardPanel") setClipboardPanelExpanded(true);
    document.getElementById(id)?.scrollIntoView({ block: "start" });
    return;
  }
  if (id && views.some((view) => view.id === id)) showView(id);
}

function applyUiCopy() {
  readClipboard && (readClipboard.textContent = isLocalAccess ? "读取电脑剪贴板" : "读取手机剪贴板");
  sendClipboard && (sendClipboard.textContent = "同步到互传");
  clipboardInput && (clipboardInput.placeholder = isLocalAccess ? "粘贴文字、链接，或点击“读取电脑剪贴板”" : "长按粘贴手机剪贴板，或点击“读取手机剪贴板”");
  setClipboardHint(isLocalAccess ? "电脑端可自动监听文字；文件和图片需要点击同步，避免误传隐私。" : "手机浏览器不会后台读取剪贴板，需要你点击按钮或长按粘贴后再同步。");
}

function mergeSettings(next = {}) {
  settings.deviceName = next.deviceName || settings.deviceName || "";
  settings.accessCodeLength = Number(next.accessCodeLength) === 6 ? 6 : 4;
  settings.clipboardSync = Boolean(next.clipboardSync);
  settings.securityMode = Boolean(next.securityMode);
}

async function loadSettings() {
  if (!isLocalAccess) return;
  try {
    const response = await fetch("/api/settings");
    if (!response.ok) return;
    const data = await response.json();
    mergeSettings(data.settings || {});
    if (data.accessCode) currentAccessCode = data.accessCode;
  } catch {}
}

function applySettings() {
  if (deviceNameInput) deviceNameInput.value = settings.deviceName;
  if (clipboardSyncToggle) clipboardSyncToggle.checked = settings.clipboardSync;
  if (settingClipboardSync) settingClipboardSync.checked = settings.clipboardSync;
  if (securityModeSetting) securityModeSetting.checked = settings.securityMode;
  if (accessLengthSetting) accessLengthSetting.value = String(settings.accessCodeLength);
  if (accessLengthSetting) accessLengthSetting.disabled = settings.securityMode;
  if (accessCodeMeta) accessCodeMeta.textContent = `${settings.accessCodeLength} 位数字`;
  if (accessCodeValue && currentAccessCode) accessCodeValue.textContent = currentAccessCode;
  clipboardPanel?.classList.toggle("listening", Boolean(settings.clipboardSync));
  updateClipboardPolling();
}

async function saveSettings(partial, { announce = true } = {}) {
  mergeSettings({ ...settings, ...partial });
  applySettings();
  localStorage.setItem("lanDrop.clipboardSync", String(settings.clipboardSync));
  localStorage.setItem("lanDrop.deviceName", settings.deviceName);
  if (!isLocalAccess) return;
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "保存设置失败");
  mergeSettings(data.settings || settings);
  if (data.accessCode) {
    currentAccessCode = data.accessCode;
    accessCodeValue.textContent = currentAccessCode || "未获取";
  }
  applySettings();
  if (data.codeChanged) showStatus("访问码已刷新，旧访问码已失效", "ok");
  else if (announce) showStatus("设置已保存", "ok");
}

function setClipboardSync(enabled) {
  saveSettings({ clipboardSync: Boolean(enabled) }, { announce: false }).catch((error) => {
    showStatus(error.message, "error");
  });
}

function updateClipboardPolling() {
  if (clipboardPollTimer) {
    clearInterval(clipboardPollTimer);
    clipboardPollTimer = null;
  }
  if (!isLocalAccess) return;
  if (!settings.clipboardSync) return;
  clipboardPollTimer = setInterval(readClipboardSilently, 2500);
  readClipboardSilently();
}

async function readClipboardSilently() {
  if (!settings.clipboardSync || document.hidden) return;
  try {
    const text = normalizeClipboardText(await readClipboardText());
    const fingerprint = textFingerprint(text);
    const rememberedFingerprint = localStorage.getItem(lastClipboardTextKey);
    if (!text || fingerprint === lastAutoClipboardText || fingerprint === rememberedFingerprint || hasRecentClipboardText(text)) {
      if (text) {
        lastAutoClipboardText = fingerprint;
        localStorage.setItem(lastClipboardTextKey, fingerprint);
      }
      return;
    }
    lastAutoClipboardText = fingerprint;
    localStorage.setItem(lastClipboardTextKey, fingerprint);
    await postItem({ type: "text", text, source: "clipboard" });
    setClipboardHint("已自动记录新的剪贴板文字。", "ok");
  } catch {
    setClipboardSync(false);
    setClipboardHint("浏览器暂时不允许自动读取剪贴板，已关闭实时监听。可以手动 Ctrl + V。", "error");
  }
}

async function readClipboardText() {
  if (isLocalAccess) {
    const response = await fetch("/api/clipboard/text");
    if (response.ok) {
      const data = await response.json();
      return data.text || "";
    }
  }
  if (!navigator.clipboard?.readText) throw new Error("Clipboard read unavailable");
  return navigator.clipboard.readText();
}

function friendlyError(message) {
  if (message === "Access code required.") return "登录已失效，请刷新页面后重新输入访问码。";
  if (message === "The upload is too large. Keep one item under 200 MB.") return "文件太大，单个文件请控制在 200 MB 以内。";
  if (message === "Clipboard file is too large. Keep one item under 200 MB.") return "剪贴板里的文件太大，单个文件请控制在 200 MB 以内。";
  if (message === "Clipboard has no readable files.") return "剪贴板里的文件暂时读不到，试试重新复制文件。";
  if (message === "Clipboard is empty.") return "剪贴板里没有可同步内容。";
  if (message === "Clipboard text is empty.") return "剪贴板文字为空。";
  return message || "操作失败";
}

function itemMatchesFilters(item) {
  const query = searchInput.value.trim().toLowerCase();
  const filter = typeFilter.value;
  const isImage = (item.mime || "").startsWith("image/");
  if (filter === "text" && item.type !== "text") return false;
  if (filter === "image" && !isImage) return false;
  if (filter === "file" && (item.type !== "file" || isImage)) return false;
  if (!query) return true;
  return [item.name, item.filename, item.text, item.mime]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function dateKeyForItem(item) {
  return new Date(item.createdAt).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function groupLabelForItem(item) {
  const itemDate = new Date(item.createdAt);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const itemKey = itemDate.toDateString();
  if (itemKey === today.toDateString()) return "今天";
  if (itemKey === yesterday.toDateString()) return "昨天";
  return dateKeyForItem(item);
}

function createItemNode(item) {
  const node = template.content.firstElementChild.cloneNode(true);
  const preview = node.querySelector(".preview");
  const title = node.querySelector("strong");
  const detail = node.querySelector(".item-detail");
  const typeBadge = node.querySelector(".item-type");
  const link = node.querySelector("a");
  const copyButton = node.querySelector(".copy-text");
  const saveNoteButton = node.querySelector(".save-note");
  const deleteButton = node.querySelector(".delete-item");
  const dangerous = isDangerousItem(item);

  link.href = authUrl(item.url);
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = dangerous ? "下载" : item.type === "file" && (item.mime || "").startsWith("image/") ? "预览" : "打开";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    openItem(item);
  });
  preview.addEventListener("click", () => {
    openItem(item);
  });
  preview.classList.add("clickable");

  if (item.type === "text") {
    preview.textContent = "TXT";
    title.textContent = item.text.slice(0, 90);
    typeBadge.textContent = looksLikeUrl(item.text) ? "链接" : item.source === "clipboard" ? "剪贴板" : "文字";
    detail.textContent = `${formatTime(item.createdAt)} · ${item.filename}`;
    copyButton.hidden = false;
    copyButton.textContent = "复制文字";
    copyButton.addEventListener("click", () => copyText(item.text, copyButton));
  } else {
    title.textContent = item.name || item.filename;
    const isImage = (item.mime || "").startsWith("image/");
    typeBadge.textContent = dangerous ? "谨慎打开" : isImage ? "图片" : "文件";
    if (dangerous) typeBadge.classList.add("danger-badge");
    detail.textContent = `${formatTime(item.createdAt)} · ${formatSize(item.size)} · ${item.filename}${dangerous ? ` · ${dangerReason(item)}` : ""}`;
    if (isImage) {
      const image = document.createElement("img");
      image.src = authUrl(item.url);
      image.alt = item.name || "image";
      preview.append(image);
      copyButton.hidden = false;
      copyButton.textContent = "复制";
      copyButton.addEventListener("click", () => copyImage(item, copyButton));
    } else {
      preview.textContent = (item.name || "FILE").split(".").pop().slice(0, 4).toUpperCase();
      copyButton.hidden = false;
      copyButton.textContent = "复制";
      copyButton.addEventListener("click", () => copyFile(item, copyButton));
    }
  }

  saveNoteButton?.addEventListener("click", () => saveItemToNote(item, saveNoteButton));
  deleteButton.addEventListener("click", () => deleteItem(item));
  return node;
}

function render() {
  itemsEl.innerHTML = "";
  renderClipboardHistory();
  const visibleItems = items.filter(itemMatchesFilters);
  if (!visibleItems.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = items.length
      ? "<strong>没有匹配的内容</strong><span>换个关键词或类型再试试。</span>"
      : "<strong>还没有收到内容</strong><span>从手机发送文件后会显示在这里。</span>";
    itemsEl.append(empty);
    return;
  }

  let previousGroup = "";
  for (const item of visibleItems) {
    const group = groupLabelForItem(item);
    if (group !== previousGroup) {
      const heading = document.createElement("div");
      heading.className = "item-group-heading";
      heading.textContent = group;
      itemsEl.append(heading);
      previousGroup = group;
    }
    itemsEl.append(createItemNode(item));
  }
}

function renderClipboardHistory() {
  if (!clipboardHistory) return;
  clipboardHistory.innerHTML = "";
  const allEntries = items
    .filter((item) => item.source === "clipboard" || (item.type === "text" && looksLikeUrl(item.text)))
    .slice(0, 40);
  const entries = allEntries.slice(0, clipboardHistoryExpanded ? 8 : 2);
  if (clipboardHistoryPanel) clipboardHistoryPanel.classList.toggle("collapsed", !clipboardHistoryExpanded);
  if (toggleClipboardHistory) {
    toggleClipboardHistory.hidden = allEntries.length <= 2;
    toggleClipboardHistory.textContent = clipboardHistoryExpanded ? "收起历史" : `展开历史${allEntries.length ? `（${allEntries.length}）` : ""}`;
  }
  if (clipboardHistorySummary) {
    clipboardHistorySummary.textContent = allEntries.length
      ? `共 ${allEntries.length} 条，默认只显示最近 2 条，避免挡住互传列表。`
      : "最近通过剪贴板同步的内容会显示在这里。";
  }

  if (!allEntries.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = "<strong>还没有剪贴板内容</strong><span>电脑端可开启实时监听；手机端请点击读取剪贴板或长按粘贴后同步。</span>";
    clipboardHistory.append(empty);
    return;
  }

  for (const item of entries) {
    const row = document.createElement("article");
    row.className = "clipboard-history-item";
    const title = document.createElement("strong");
    const isImage = item.type === "file" && (item.mime || "").startsWith("image/");
    const dangerous = isDangerousItem(item);
    if (!isImage) row.classList.add("no-preview");
    title.textContent = item.type === "text" ? (looksLikeUrl(item.text) ? "链接" : "文字") : dangerous ? "谨慎打开" : isImage ? "图片" : "文件";
    const body = document.createElement("p");
    body.textContent = item.type === "text" ? item.text : `${item.name || item.filename}${dangerous ? ` · ${dangerReason(item)}` : ""}`;
    const meta = document.createElement("span");
    meta.textContent = item.type === "text" ? formatTime(item.createdAt) : `${formatTime(item.createdAt)} · ${formatSize(item.size)}`;
    if (isImage) {
      const preview = document.createElement("button");
      preview.type = "button";
      preview.className = "clipboard-preview";
      preview.title = "预览图片";
      const image = document.createElement("img");
      image.src = authUrl(item.url);
      image.alt = item.name || "剪贴板图片";
      preview.append(image);
      preview.addEventListener("click", () => openImagePreview(item));
      row.append(preview);
    }
    const actions = document.createElement("div");
    actions.className = "clipboard-history-actions";
    if (item.type !== "text") {
      const open = document.createElement("button");
      open.type = "button";
      open.className = "secondary";
      open.textContent = isImage ? "预览" : "打开";
      open.addEventListener("click", () => openItem(item));
      actions.append(open);
    }
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "secondary";
    copy.textContent = "复制";
    copy.addEventListener("click", () => {
      if (item.type === "text") return copyText(item.text, copy);
      if (isImage) return copyImage(item, copy);
      return copyFile(item, copy);
    });
    const saveNote = document.createElement("button");
    saveNote.type = "button";
    saveNote.className = "ghost";
    saveNote.textContent = "存随记";
    saveNote.addEventListener("click", () => saveItemToNote(item, saveNote));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "删除";
    remove.addEventListener("click", () => deleteItem(item));
    actions.append(copy, saveNote, remove);
    row.append(title, body, meta, actions);
    clipboardHistory.append(row);
  }
}

function renderDevices() {
  if (!devicesPanel || !devicesList) return;
  devicesPanel.hidden = !isLocalAccess;
  if (!isLocalAccess) return;
  devicesList.innerHTML = "";

  if (!devices.length) {
    const empty = document.createElement("div");
    empty.className = "device-empty";
    empty.textContent = "还没有手机或其他浏览器通过访问码连接。";
    devicesList.append(empty);
    return;
  }

  for (const device of devices) {
    const row = document.createElement("article");
    row.className = `device-row ${device.active ? "active" : ""}`;
    const meta = document.createElement("div");
    meta.className = "device-meta";
    const title = document.createElement("strong");
    title.textContent = device.name || "未知设备";
    const detail = document.createElement("span");
    detail.textContent = [
      device.ip || "未知 IP",
      `最后访问 ${formatRelativeTime(device.lastSeenAt)}`,
      device.firstSeenAt ? `首次连接 ${formatTime(device.firstSeenAt)}` : ""
    ].filter(Boolean).join(" · ");
    meta.append(title, detail);

    const badges = document.createElement("div");
    badges.className = "device-badges";
    const status = document.createElement("span");
    status.className = device.active ? "device-status active" : "device-status";
    status.textContent = device.active ? "在线" : "离线";
    badges.append(status);
    if (device.sessionCount > 1) {
      const session = document.createElement("span");
      session.className = "device-status session";
      session.textContent = `${device.sessionCount} 次会话`;
      badges.append(session);
    }

    const kick = document.createElement("button");
    kick.type = "button";
    kick.className = device.active ? "danger compact-action" : "ghost compact-action";
    kick.textContent = device.active ? "断开" : "删除";
    kick.title = device.active ? "断开这台设备，需要重新输入访问码才能访问" : "删除这条离线设备记录";
    kick.addEventListener("click", () => revokeDevice(device));

    row.append(meta, badges, kick);
    devicesList.append(row);
  }
}

async function loadDevices() {
  if (!isLocalAccess) return;
  const response = await fetch("/api/devices");
  if (!response.ok) return;
  const data = await response.json();
  devices = data.devices || [];
  renderDevices();
}

async function revokeDevice(device) {
  const label = device.active ? "断开连接" : "删除记录";
  const message = device.active
    ? `断开“${device.name || "这台设备"}”？它需要重新输入访问码才能访问。`
    : `删除“${device.name || "这台设备"}”的离线记录？`;
  if (!confirm(message)) return;
  const response = await fetch(`/api/devices/${encodeURIComponent(device.id)}`, { method: "DELETE" });
  if (!response.ok) {
    showStatus(`${label}失败`, "error");
    return;
  }
  const data = await response.json();
  devices = data.devices || [];
  renderDevices();
  showStatus(device.active ? "已断开连接" : "已删除记录", "ok");
}

function renderUpdateResult(data) {
  if (!updatePanel || !updateSummary || !updateActions) return;
  updateActions.innerHTML = "";
  const current = data.currentVersion || appVersion || "未知";
  const platformName = data.platformName || "当前系统";
  const recommendedAsset = data.recommendedAsset || data.windowsAsset || data.macAsset;

  if (data.updateAvailable) {
    const version = data.name || data.tagName || "新版本";
    updateSummary.textContent = `检测到你的系统：${platformName}。发现 ${version}，当前版本 v${current}，建议下载 ${platformName} 安装包覆盖旧版。`;
    if (recommendedAsset) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `下载并安装 ${platformName} 版${recommendedAsset.size ? ` · ${formatSize(recommendedAsset.size)}` : ""}`;
      button.title = recommendedAsset.name || "";
      button.addEventListener("click", () => installUpdate(recommendedAsset, button));
      updateActions.append(button);
    }
  } else {
    updateSummary.textContent = `检测到你的系统：${platformName}。当前版本 v${current}，已经是最新可用版本。`;
  }

  if (data.htmlUrl) {
    const openRelease = document.createElement("button");
    openRelease.type = "button";
    openRelease.dataset.secondaryUpdate = "true";
    openRelease.textContent = data.updateAvailable ? "其他系统版本" : "查看下载页";
    openRelease.addEventListener("click", () => window.open(data.htmlUrl, "_blank", "noopener"));
    updateActions.append(openRelease);

    const copyLink = document.createElement("button");
    copyLink.type = "button";
    copyLink.dataset.secondaryUpdate = "true";
    copyLink.textContent = "复制下载页";
    copyLink.addEventListener("click", () => copyText(data.htmlUrl, copyLink));
    updateActions.append(copyLink);
  }
}

function renderUpdateProgress(state = {}) {
  if (!updateSummary) return;
  const total = Number(state.totalBytes || 0);
  const received = Number(state.receivedBytes || 0);
  const progress = total > 0 ? `已下载 ${formatSize(received)} / ${formatSize(total)}` : `已下载 ${formatSize(received)}`;
  if (state.status === "downloading") {
    updateSummary.textContent = `${state.message || "正在下载更新包..."} ${progress}。下载完成后会自动打开安装包并退出旧版。`;
  } else if (state.status === "installing") {
    updateSummary.textContent = "下载完成，正在打开安装包。旧版会自动退出，请按安装器提示覆盖安装。";
  } else if (state.status === "error") {
    updateSummary.textContent = `更新失败：${state.error || state.message || "未知错误"}。可以稍后重试，或打开下载页手动下载。`;
  }
}

async function pollUpdateStatus(button) {
  clearInterval(updatePollTimer);
  updatePollTimer = setInterval(async () => {
    try {
      const response = await fetch("/api/update/status");
      const state = await response.json();
      if (!response.ok) throw new Error(state.error || "读取更新状态失败");
      renderUpdateProgress(state);
      if (button && state.status === "downloading") {
        const total = Number(state.totalBytes || 0);
        const received = Number(state.receivedBytes || 0);
        const percent = total > 0 ? Math.max(1, Math.min(99, Math.round((received / total) * 100))) : "";
        button.textContent = percent ? `下载中 ${percent}%` : "下载中...";
        button.disabled = true;
      }
      if (["installing", "error", "idle"].includes(state.status)) {
        clearInterval(updatePollTimer);
        updatePollTimer = null;
        if (button && state.status === "error") {
          button.disabled = false;
          button.textContent = "重新下载并安装";
        }
      }
    } catch (error) {
      clearInterval(updatePollTimer);
      updatePollTimer = null;
      if (button) button.disabled = false;
      showStatus(error.message, "error");
    }
  }, 1000);
}

async function installUpdate(asset, button) {
  if (!asset?.browserDownloadUrl) {
    showStatus("没有找到适合当前系统的安装包", "error");
    return;
  }
  const confirmed = confirm("开始下载新版安装包。下载完成后会自动打开安装包，并退出当前旧版。继续吗？");
  if (!confirmed) return;
  button.disabled = true;
  button.textContent = "准备下载...";
  updateSummary.textContent = "正在准备下载更新包...";
  try {
    const response = await fetch("/api/update/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset })
    });
    const state = await response.json();
    if (!response.ok) throw new Error(state.error || "无法开始更新");
    renderUpdateProgress(state);
    pollUpdateStatus(button);
  } catch (error) {
    button.disabled = false;
    button.textContent = "重新下载并安装";
    updateSummary.textContent = `更新失败：${error.message}`;
    showStatus("更新失败", "error");
  }
}

for (const button of viewButtons) {
  button.addEventListener("click", () => {
    history.replaceState(null, "", `#${button.dataset.viewTarget}`);
    showView(button.dataset.viewTarget);
    resetWorkspaceScroll();
  });
}

document.querySelector('a[href="#dropZone"]')?.addEventListener("click", () => showView("transferView"));
document.querySelector('a[href="#receivedFeed"]')?.addEventListener("click", () => showView("transferView"));
document.querySelector('a[href="#clipboardPanel"]')?.addEventListener("click", () => {
  showView("transferView");
  setClipboardPanelExpanded(true);
});

toggleClipboardPanel?.addEventListener("click", () => {
  setClipboardPanelExpanded(!clipboardPanelExpanded);
});

openDevicesView?.addEventListener("click", () => {
  history.replaceState(null, "", "#devicesView");
  showView("devicesView");
  resetWorkspaceScroll();
});

for (const link of document.querySelectorAll('a[href="/yaoji/"]')) {
  link.addEventListener("click", () => {
    sessionStorage.setItem("lanDrop.yaojiOpen", "true");
    revealYaojiNav();
  });
}

clipboardSyncToggle?.addEventListener("change", () => {
  setClipboardSync(clipboardSyncToggle.checked);
  setClipboardHint(clipboardSyncToggle.checked ? "实时监听已开启。复制新文字后会自动记录。" : "实时监听已关闭。", "info");
});

settingClipboardSync?.addEventListener("change", () => {
  setClipboardSync(settingClipboardSync.checked);
});

securityModeSetting?.addEventListener("change", () => {
  const enabled = securityModeSetting.checked;
  const message = enabled
    ? "开启安全模式会刷新为 6 位访问码，已连接的手机需要重新输入。确定开启吗？"
    : "关闭安全模式后可以改回 4 位访问码，当前已连接设备可能需要重新输入。确定关闭吗？";
  if (!confirm(message)) {
    securityModeSetting.checked = settings.securityMode;
    return;
  }
  saveSettings({ securityMode: enabled, accessCodeLength: enabled ? 6 : settings.accessCodeLength }).catch((error) => {
    showStatus(error.message, "error");
  });
});

deviceNameInput?.addEventListener("input", () => {
  settings.deviceName = deviceNameInput.value.trim();
  localStorage.setItem("lanDrop.deviceName", settings.deviceName);
});

deviceNameInput?.addEventListener("change", () => {
  saveSettings({ deviceName: deviceNameInput.value.trim() }).catch((error) => {
    showStatus(error.message, "error");
  });
});

accessLengthSetting?.addEventListener("change", () => {
  if (settings.securityMode) {
    accessLengthSetting.value = "6";
    return showStatus("安全模式下固定使用 6 位访问码", "info");
  }
  const nextLength = Number(accessLengthSetting.value) === 6 ? 6 : 4;
  if (nextLength !== settings.accessCodeLength) {
    const ok = confirm("修改访问码长度会刷新访问码，已经连接的手机需要重新输入。确定修改吗？");
    if (!ok) {
      accessLengthSetting.value = String(settings.accessCodeLength);
      return;
    }
  }
  saveSettings({ accessCodeLength: nextLength }).catch((error) => {
    showStatus(error.message, "error");
  });
});

copyInboxPath?.addEventListener("click", () => {
  if (!inboxDirectory) return showStatus("还没有读取到保存目录", "error");
  copyText(inboxDirectory, copyInboxPath);
});

openInboxPath?.addEventListener("click", async () => {
  const response = await fetch("/api/open-inbox", { method: "POST" });
  if (!response.ok) return showStatus("打开保存目录失败", "error");
  flashAction(openInboxPath, "已打开");
});

function renderLocalBackups(backups = [], directory = "", max = 10) {
  if (!localBackupSummary || !localBackupList) return;
  localBackupSummary.textContent = backups.length
    ? `已保留 ${backups.length}/${max} 份`
    : "还没有本机恢复点";
  localBackupSummary.title = directory || "";
  localBackupList.innerHTML = "";

  if (directory) {
    const pathRow = document.createElement("div");
    pathRow.className = "local-backup-path";
    pathRow.textContent = `位置：${directory}`;
    localBackupList.append(pathRow);
  }

  if (!backups.length) {
    const empty = document.createElement("div");
    empty.className = "local-backup-empty";
    empty.textContent = "每天启动会自动生成一份，也可以点“立即备份到本机”。";
    localBackupList.append(empty);
    return;
  }

  for (const backup of backups) {
    const row = document.createElement("article");
    row.className = "local-backup-item";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = formatBackupTime(backup.exportedAt || backup.updatedAt);
    const meta = document.createElement("span");
    meta.textContent = `${formatSize(backup.size || 0)} · 随记 ${backup.notes || 0} 条 · 图片 ${backup.noteFiles || 0} 个 · 记录 ${backup.items || 0} 条`;
    const file = document.createElement("code");
    file.textContent = backup.filename;
    info.append(title, meta, file);

    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "secondary";
    restore.textContent = "恢复";
    restore.addEventListener("click", () => restoreLocalBackup(backup.filename, restore));

    row.append(info, restore);
    localBackupList.append(row);
  }
}

async function loadLocalBackups() {
  if (!isLocalAccess || !backupPanel) return;
  try {
    const response = await fetch("/api/backups");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "读取本机恢复点失败");
    renderLocalBackups(data.backups || [], data.directory || "", data.max || 10);
  } catch (error) {
    if (localBackupSummary) localBackupSummary.textContent = error.message;
  }
}

async function restoreLocalBackup(filename, button) {
  if (!confirm("恢复这个本机恢复点会覆盖当前随记、钥记加密文件、设置和访问码。恢复前会先自动保存当前状态，确定继续吗？")) return;
  try {
    button.disabled = true;
    button.textContent = "恢复中...";
    const response = await fetch("/api/backups/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "恢复本机恢复点失败");
    mergeSettings(data.settings || settings);
    if (data.accessCode) {
      currentAccessCode = data.accessCode;
      accessCodeValue.textContent = currentAccessCode;
    }
    applySettings();
    renderLocalBackups(data.backups || [], data.directory || "", data.max || 10);
    showStatus(`已恢复：随记 ${data.restored?.notes || 0} 条，图片 ${data.restored?.noteFiles || 0} 个`, "ok");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "恢复";
  }
}

createLocalBackup?.addEventListener("click", async () => {
  try {
    createLocalBackup.disabled = true;
    createLocalBackup.textContent = "备份中...";
    const response = await fetch("/api/backups", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "创建本机备份失败");
    renderLocalBackups(data.backups || [], data.directory || "", data.max || 10);
    showStatus(data.backup?.reused ? "当前内容已经备份过，没有重复新增" : "已保存到本机恢复点", "ok");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    createLocalBackup.disabled = false;
    createLocalBackup.textContent = "立即备份到本机";
  }
});

openBackupPath?.addEventListener("click", async () => {
  const response = await fetch("/api/open-backups", { method: "POST" });
  if (!response.ok) return showStatus("打开本地备份目录失败", "error");
  flashAction(openBackupPath, "已打开");
});

exportBackup?.addEventListener("click", async () => {
  try {
    exportBackup.disabled = true;
    exportBackup.textContent = "正在导出...";
    const response = await fetch("/api/backup/export");
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "导出备份失败");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/i);
    const filename = match?.[1] || `lan-drop-backup-${Date.now()}.json`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showStatus("备份已导出", "ok");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    exportBackup.disabled = false;
    exportBackup.textContent = "导出备份";
  }
});

importBackupInput?.addEventListener("change", async () => {
  const file = importBackupInput.files?.[0];
  if (!file) return;
  try {
    const ok = confirm("导入备份会覆盖当前随记、钥记加密文件、设置和访问码。确定继续吗？");
    if (!ok) return;
    const text = await file.text();
    const response = await fetch("/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: text
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "导入备份失败");
    mergeSettings(data.settings || settings);
    if (data.accessCode) {
      currentAccessCode = data.accessCode;
      accessCodeValue.textContent = currentAccessCode;
    }
    applySettings();
    loadLocalBackups();
    showStatus(`备份已恢复：随记 ${data.restored?.notes || 0} 条，图片 ${data.restored?.noteFiles || 0} 个`, "ok");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    importBackupInput.value = "";
  }
});

clearClipboardHistory?.addEventListener("click", async () => {
  const entries = items.filter((item) => item.source === "clipboard" || (item.type === "text" && looksLikeUrl(item.text)));
  if (!entries.length) return showStatus("没有可清空的剪贴板历史", "info");
  if (!confirm(`清空 ${entries.length} 条剪贴板历史？这会删除对应的文字、图片和文件记录。`)) return;
  const response = await fetch("/api/clipboard/history", { method: "DELETE" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return showStatus(data.error || "清空剪贴板历史失败", "error");
  }
  const data = await response.json();
  const removed = new Set(data.ids || entries.map((item) => item.id));
  items = items.filter((item) => !removed.has(item.id));
  render();
  showStatus(`已清空 ${data.removed || removed.size} 条剪贴板历史`, "ok");
});

toggleClipboardHistory?.addEventListener("click", () => {
  clipboardHistoryExpanded = !clipboardHistoryExpanded;
  renderClipboardHistory();
});

clearTransferItems?.addEventListener("click", async () => {
  if (!items.length) return showStatus("互传列表已经是空的", "info");
  if (!confirm(`清空 ${items.length} 条互传内容？重要内容请先点“存随记”。这会删除对应文件记录。`)) return;
  const response = await fetch("/api/items", { method: "DELETE" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return showStatus(data.error || "清空互传列表失败", "error");
  const removed = new Set(data.ids || items.map((item) => item.id));
  items = items.filter((item) => !removed.has(item.id));
  render();
  showStatus(`已清空 ${data.removed || removed.size} 条互传内容`, "ok");
});

closeImagePreview?.addEventListener("click", closeImagePreviewDialog);

imagePreviewDialog?.addEventListener("click", (event) => {
  if (event.target === imagePreviewDialog) closeImagePreviewDialog();
});

copyPreviewImage?.addEventListener("click", () => {
  if (!activePreviewItem) return;
  copyImage(activePreviewItem, copyPreviewImage);
});

openPreviewImage?.addEventListener("click", async () => {
  if (!activePreviewItem) return;
  const item = activePreviewItem;
  closeImagePreviewDialog();
  if (isLocalAccess && item.filename) {
    try {
      const response = await fetch("/api/open-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: item.filename })
      });
      if (response.ok) {
        showStatus("已用系统打开图片", "ok");
        return;
      }
    } catch {}
  }
  window.open(authUrl(item.url), "_blank", "noopener");
});

qrCode?.addEventListener("click", openQrPreview);
closeQrPreview?.addEventListener("click", closeQrPreviewDialog);
qrPreviewDialog?.addEventListener("click", (event) => {
  if (event.target === qrPreviewDialog) closeQrPreviewDialog();
});

function openQrPreview() {
  if (!qrCode?.src || !qrPreviewDialog || !qrPreviewImage) return;
  qrPreviewImage.src = qrCode.src;
  if (qrPreviewUrl) qrPreviewUrl.textContent = phoneUrl;
  if (typeof qrPreviewDialog.showModal === "function") {
    qrPreviewDialog.showModal();
  } else {
    qrPreviewDialog.setAttribute("open", "");
  }
}

function closeQrPreviewDialog() {
  if (!qrPreviewDialog) return;
  if (typeof qrPreviewDialog.close === "function") qrPreviewDialog.close();
  else qrPreviewDialog.removeAttribute("open");
}

async function checkForUpdates({ quiet = false } = {}) {
  if (!isLocalAccess || !updatePanel || !checkUpdate || !updateActions) return;
  const original = checkUpdate.textContent;
  checkUpdate.disabled = true;
  checkUpdate.textContent = "检查中...";
  if (!quiet && updateSummary) updateSummary.textContent = "正在连接 GitHub Releases 检查新版本...";
  try {
    const response = await fetch("/api/update/latest");
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "检查失败");
    renderUpdateResult(data);
    if (data.updateAvailable) showStatus(quiet ? "发现新版本，可到设置里下载" : "发现新版本", "ok");
    else if (!quiet) showStatus("当前已是最新版本", "ok");
  } catch (error) {
    if (!quiet && updateSummary) updateSummary.textContent = `检查更新失败：${error.message}。可以稍后重试，或手动打开 GitHub Releases。`;
    if (!quiet) {
      updateActions.innerHTML = "";
      const openRelease = document.createElement("button");
      openRelease.type = "button";
      openRelease.className = "secondary";
      openRelease.textContent = "打开下载页";
      openRelease.addEventListener("click", () => {
        window.open("https://github.com/t01094738688-commits/lan-drop/releases", "_blank", "noopener");
      });
      updateActions.append(openRelease);
    }
    if (!quiet) showStatus("检查更新失败", "error");
  } finally {
    checkUpdate.disabled = false;
    checkUpdate.textContent = original || "检查更新";
  }
}

async function previewClipboard() {
  if (!isLocalAccess) {
    const text = (await navigator.clipboard?.readText?.().catch(() => "") || "").trim();
    if (!text) throw new Error("手机浏览器没有读到剪贴板内容，请长按输入框粘贴后再同步。");
    lastClipboardPreview = { type: "text", count: 1, text };
    return lastClipboardPreview;
  }
  const response = await fetch("/api/clipboard/preview");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "读取剪贴板失败");
  lastClipboardPreview = data.clipboard || { type: "empty" };
  if (lastClipboardPreview.type === "empty" && navigator.clipboard?.readText) {
    const text = (await navigator.clipboard.readText().catch(() => "")).trim();
    if (text) lastClipboardPreview = { type: "text", count: 1, text };
  }
  return lastClipboardPreview;
}

async function importClipboard() {
  if (!isLocalAccess) {
    const text = (await navigator.clipboard?.readText?.().catch(() => "") || "").trim();
    if (!text) throw new Error("手机浏览器没有读到剪贴板内容，请长按输入框粘贴后再同步。");
    const item = await postItem({ type: "text", text, source: "clipboard" });
    return item ? [item] : [];
  }
  const response = await fetch("/api/clipboard/import", { method: "POST" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(friendlyError(data.error || "同步剪贴板失败"));
  lastClipboardPreview = data.clipboard || null;
  const imported = data.items || [];
  if (imported.length) {
    items = [...imported, ...items.filter((entry) => !imported.some((item) => item.id === entry.id))];
    render();
  }
  return imported;
}

async function postItem(payload) {
  const response = await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(friendlyError(data.error || "发送失败"));
  }
  const data = await response.json().catch(() => ({}));
  if (data.item) {
    items = [data.item, ...items.filter((entry) => entry.id !== data.item.id)];
    render();
  }
  return data.item;
}

async function saveItemToNote(item, button) {
  try {
    const response = await fetch("/api/notes/from-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, categoryId: "other" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "存入随记失败");
    flashAction(button, "已存入");
    showStatus("已存为随记", "ok");
  } catch (error) {
    showStatus(error.message, "error");
    flashAction(button, "失败");
  }
}

async function deleteItem(item, { confirmDelete = true, announce = true } = {}) {
  if (confirmDelete && !confirm(`删除“${item.name || item.filename}”？`)) return false;
  const response = await fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    showStatus(data.error || "删除失败", "error");
    return false;
  }
  items = items.filter((entry) => entry.id !== item.id);
  render();
  if (announce) showStatus("已删除", "ok");
  return true;
}

function updateQueue() {
  queuePanel.hidden = !queue.length;
  queueList.innerHTML = "";
  const active = queue.filter((entry) => entry.status === "uploading").length;
  queueSummary.textContent = active ? `${active} 个正在发送` : `${queue.length} 个任务`;

  for (const entry of queue) {
    const row = document.createElement("div");
    row.className = `queue-row ${entry.status}`;
    const meta = document.createElement("div");
    meta.className = "queue-meta";
    const title = document.createElement("strong");
    title.textContent = entry.file.name || "文件";
    const detail = document.createElement("span");
    detail.textContent =
      entry.status === "uploading"
        ? `${entry.progress}% · ${formatSize(entry.file.size)}`
        : entry.statusText;
    meta.append(title, detail);

    const progress = document.createElement("progress");
    progress.max = 100;
    progress.value = entry.progress;

    const actions = document.createElement("div");
    actions.className = "queue-actions";
    if (entry.status === "uploading") {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "ghost";
      cancel.textContent = "取消";
      cancel.addEventListener("click", () => entry.xhr?.abort());
      actions.append(cancel);
    }
    if (entry.status === "failed" || entry.status === "canceled") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "重试";
      retry.addEventListener("click", () => uploadQueueEntry(entry));
      actions.append(retry);
    }
    row.append(meta, progress, actions);
    queueList.append(row);
  }
}

function uploadQueueEntry(entry) {
  entry.status = "uploading";
  entry.statusText = "正在发送";
  entry.progress = 0;
  updateQueue();

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    entry.xhr = xhr;
    xhr.open("POST", "/api/upload");
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", entry.file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(entry.file.name || "upload"));
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      entry.progress = Math.round((event.loaded / event.total) * 100);
      updateQueue();
    });
    xhr.addEventListener("load", () => {
      entry.xhr = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        entry.status = "done";
        entry.statusText = "已发送";
        entry.progress = 100;
        setTimeout(() => {
          queue = queue.filter((item) => item !== entry);
          updateQueue();
        }, 1600);
      } else {
        let error = "上传失败";
        try {
          error = friendlyError(JSON.parse(xhr.responseText).error || error);
        } catch {}
        entry.status = "failed";
        entry.statusText = error;
      }
      updateQueue();
      resolve();
    });
    xhr.addEventListener("error", () => {
      entry.xhr = null;
      entry.status = "failed";
      entry.statusText = "网络中断";
      updateQueue();
      resolve();
    });
    xhr.addEventListener("abort", () => {
      entry.xhr = null;
      entry.status = "canceled";
      entry.statusText = "已取消";
      updateQueue();
      resolve();
    });
    xhr.send(entry.file);
  });
}

async function sendFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const entries = files.map((file) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    file,
    progress: 0,
    status: "queued",
    statusText: "等待发送",
    xhr: null
  }));
  queue = [...queue, ...entries];
  updateQueue();
  for (const entry of entries) {
    await uploadQueueEntry(entry);
  }
}

fileInput.addEventListener("change", async () => {
  try {
    await sendFiles(fileInput.files);
  } finally {
    fileInput.value = "";
  }
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  await sendFiles(event.dataTransfer.files);
});

document.addEventListener("paste", async (event) => {
  const files = [...event.clipboardData.files];
  const text = event.clipboardData.getData("text/plain");
  if (files.length) {
    event.preventDefault();
    await sendFiles(files);
    const hasImage = files.some((file) => (file.type || "").startsWith("image/"));
    const label = files.length > 1
      ? `已把 ${files.length} 个复制的文件加入发送队列`
      : hasImage
        ? "已把复制的图片加入发送队列"
        : "已把复制的文件加入发送队列";
    setClipboardHint(label, "ok");
    showStatus(label, "ok");
  } else if (text && ![textInput, clipboardInput].includes(document.activeElement)) {
    event.preventDefault();
    try {
      await postItem({ type: "text", text, source: "clipboard" });
      showStatus("已把剪贴板文字同步到互传列表", "ok");
    } catch (error) {
      showStatus(error.message, "error");
    }
  } else if (isLocalAccess && ![textInput, clipboardInput].includes(document.activeElement)) {
    try {
      const imported = await importClipboard();
      if (imported.length) {
        event.preventDefault();
        const label = imported.length > 1 ? `已把 ${imported.length} 个剪贴板文件同步到互传列表` : "已把剪贴板内容同步到互传列表";
        setClipboardHint(label, "ok");
        showStatus(label, "ok");
      }
    } catch {}
  }
});

clipboardInput?.addEventListener("input", resizeClipboardInput);

readClipboard?.addEventListener("click", async () => {
  try {
    const preview = await previewClipboard();
    if (preview.type === "text") {
      clipboardInput.value = preview.text || "";
      resizeClipboardInput();
      setClipboardHint(clipboardPreviewLabel(preview), "ok");
      return;
    }
    setClipboardHint(clipboardPreviewLabel(preview), preview.type === "empty" ? "error" : "ok");
  } catch (error) {
    setClipboardHint(error.message || "浏览器不允许直接读取剪贴板，可以手动 Ctrl + V 粘贴。", "error");
    clipboardInput.focus();
  }
});

sendClipboard?.addEventListener("click", async () => {
  const text = clipboardInput.value.trim();
  try {
    if (text) {
      await postItem({ type: "text", text, source: "clipboard" });
      clipboardInput.value = "";
      resizeClipboardInput();
      setClipboardHint("已同步到互传列表，手机和电脑都可以查看。", "ok");
      showStatus("已同步到互传列表", "ok");
      return;
    }
    const imported = await importClipboard();
    if (!imported.length) {
      setClipboardHint("剪贴板里没有可同步内容。", "error");
      return;
    }
    const label = imported.length > 1 ? `已把 ${imported.length} 个剪贴板文件同步到互传列表。` : imported[0].type === "text" ? "已把剪贴板文字同步到互传列表。" : "已把剪贴板内容同步到互传列表。";
    setClipboardHint(label, "ok");
    showStatus(label, "ok");
  } catch (error) {
    if (/剪贴板里没有可同步内容|Clipboard is empty/i.test(error.message) && navigator.clipboard?.readText) {
      const fallbackText = (await navigator.clipboard.readText().catch(() => "")).trim();
      if (fallbackText) {
        await postItem({ type: "text", text: fallbackText, source: "clipboard" });
        setClipboardHint("已从浏览器剪贴板同步到互传列表。", "ok");
        showStatus("已同步到互传列表", "ok");
        return;
      }
    }
    setClipboardHint(error.message, "error");
    showStatus(error.message, "error");
  }
});

clearClipboard?.addEventListener("click", () => {
  clipboardInput.value = "";
  resizeClipboardInput();
  setClipboardHint("已清空输入区。", "info");
  clipboardInput.focus();
});

pasteText.addEventListener("click", () => {
  textPanel.hidden = false;
  textInput.focus();
});

cancelText.addEventListener("click", () => {
  textPanel.hidden = true;
  textInput.value = "";
});

sendText.addEventListener("click", async () => {
  await postItem({ type: "text", text: textInput.value });
  textPanel.hidden = true;
  textInput.value = "";
  showStatus("文字已同步到互传列表", "ok");
});

copyUrl.addEventListener("click", async () => {
  await copyText(phoneUrl, copyUrl);
  flashAction(copyUrl, "已复制地址");
});

copyAccessCode.addEventListener("click", async () => {
  if (!currentAccessCode) return showStatus("当前没有可复制的访问码", "error");
  await copyText(currentAccessCode, copyAccessCode);
  flashAction(copyAccessCode, "已复制访问码");
});

refreshAccessCode.addEventListener("click", async () => {
  if (!confirm("刷新访问码后，已经扫码登录的手机需要重新输入新访问码。确定刷新吗？")) return;
  const response = await fetch("/api/access/refresh", { method: "POST" });
  if (!response.ok) {
    showStatus("刷新访问码失败，请确认是在电脑本机操作。", "error");
    return;
  }
  const data = await response.json();
  currentAccessCode = data.accessCode || "";
  accessCodeValue.textContent = currentAccessCode || "未获取";
  devices = [];
  renderDevices();
  showStatus("访问码已刷新，旧访问码已失效", "ok");
});

refreshDevices?.addEventListener("click", async () => {
  await loadDevices();
  flashAction(refreshDevices, "已刷新");
});

clearOfflineDevices?.addEventListener("click", async () => {
  if (!confirm("清理所有离线设备记录？在线设备不会受影响。")) return;
  const response = await fetch("/api/devices/offline", { method: "DELETE" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    showStatus(data.error || "清理失败", "error");
    return;
  }
  devices = data.devices || [];
  renderDevices();
  showStatus(data.removed ? `已清理 ${data.removed} 条离线记录` : "没有需要清理的离线记录", "ok");
});

checkUpdate?.addEventListener("click", () => checkForUpdates());

async function boot() {
  applyUiCopy();
  let info;
  try {
    info = await fetch("/api/info").then((response) => response.json());
    serviceStatus.textContent = "已启动，手机和电脑连接同一个 Wi-Fi 后即可互传";
    serviceStatus.dataset.state = "ok";
  } catch (error) {
    serviceStatus.textContent = "未启动，请检查网络或端口占用";
    serviceStatus.dataset.state = "error";
    throw error;
  }
  isLocalAccess = !info.accessRequired;
  document.body.classList.toggle("remote-device", !isLocalAccess);
  applyUiCopy();
  if (!isLocalAccess) {
    serviceStatus.textContent = "已连接电脑，可以把手机文件、图片、文字同步到互传列表";
    serviceStatus.dataset.state = "ok";
  }
  renderDevices();
  appVersion = info.version || "";
  if (versionBadge && appVersion) versionBadge.textContent = `v${appVersion}`;
  if (updatePanel) updatePanel.hidden = !isLocalAccess;
  if (backupPanel) backupPanel.hidden = !isLocalAccess;
  if (updateSummary && appVersion) updateSummary.textContent = `当前版本 v${appVersion}。软件会自动检查更新，也可以手动点击检查。`;
  mergeSettings(info.settings || {});
  await loadSettings();
  applySettings();
  phoneUrls = info.urls || [];
  phoneUrl = phoneUrls[0] || location.href;
  recommendedUrl.textContent = phoneUrl;
  if (qrCode && phoneUrls.length) {
    qrCode.src = `/api/qr?text=${encodeURIComponent(phoneUrl)}&v=${Date.now()}`;
    qrCode.hidden = false;
  }
  currentAccessCode = info.accessCode || "";
  accessCodeValue.textContent = currentAccessCode || "远程设备输入后可使用";
  if (accessCodeMeta) accessCodeMeta.textContent = `${settings.accessCodeLength} 位数字`;
  addressList.innerHTML = "";
  for (const entry of info.addresses || []) {
    const row = document.createElement("div");
    row.className = entry.recommended ? "address-row recommended" : "address-row";
    const label = document.createElement("div");
    label.innerHTML = `<strong>${entry.recommended ? "当前网络" : "备用地址"}</strong><span>${entry.name || "网络适配器"}</span>`;
    const link = document.createElement("a");
    link.href = entry.url;
    link.textContent = entry.url;
    row.append(label, link);
    addressList.append(row);
  }
  if (!phoneUrls.length) {
    recommendedUrl.textContent = "没有检测到可用局域网地址，请确认电脑已连接网络。";
    networkName.textContent = "未检测到可用网络";
    serviceStatus.textContent = "未启动，请检查网络或端口占用";
    serviceStatus.dataset.state = "error";
  } else {
    const recommended = (info.addresses || []).find((entry) => entry.recommended) || (info.addresses || [])[0];
    networkName.textContent = recommended?.name || "当前 Wi-Fi";
  }
  inboxDirectory = info.inbox || "";
  inboxPath.textContent = `电脑保存目录：${inboxDirectory}`;
  if (settingsInboxPath) settingsInboxPath.textContent = inboxDirectory || "未读取到保存目录";

  const itemResponse = await fetch("/api/items");
  const data = await itemResponse.json();
  items = data.items || [];
  render();
  resizeClipboardInput();
  setClipboardPanelExpanded(clipboardPanelExpanded, { remember: false });
  await loadDevices();
  showInitialView();
  if (isLocalAccess) {
    loadLocalBackups();
    setTimeout(() => checkForUpdates({ quiet: true }), 800);
  }

  const events = new EventSource(authUrl("/api/events"));
  events.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "deleted") {
      items = items.filter((entry) => entry.id !== payload.id);
      render();
      return;
    }
    if (payload.type === "cleared") {
      const removed = new Set(payload.ids || []);
      items = items.filter((entry) => !removed.has(entry.id));
      render();
      return;
    }
    const item = payload.item || payload;
    items = [item, ...items.filter((entry) => entry.id !== item.id)];
    render();
    loadDevices();
  };
}

searchInput.addEventListener("input", render);
typeFilter.addEventListener("change", render);

boot().catch((error) => {
  itemsEl.innerHTML = `<div class="empty">启动失败：${error.message}</div>`;
});

