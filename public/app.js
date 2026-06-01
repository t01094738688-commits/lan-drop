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
const clipboardInput = document.querySelector("#clipboardInput");
const readClipboard = document.querySelector("#readClipboard");
const sendClipboard = document.querySelector("#sendClipboard");
const clearClipboard = document.querySelector("#clearClipboard");
const clipboardHint = document.querySelector("#clipboardHint");
const updatePanel = document.querySelector("#updatePanel");
const updateSummary = document.querySelector("#updateSummary");
const checkUpdate = document.querySelector("#checkUpdate");
const updateActions = document.querySelector("#updateActions");
const viewButtons = [...document.querySelectorAll("[data-view-target]")];
const views = [...document.querySelectorAll("[data-view]")];
const clipboardHistory = document.querySelector("#clipboardHistory");
const clipboardSyncToggle = document.querySelector("#clipboardSyncToggle");
const settingClipboardSync = document.querySelector("#settingClipboardSync");
const deviceNameInput = document.querySelector("#deviceNameInput");
const accessLengthSetting = document.querySelector("#accessLengthSetting");
const settingsInboxPath = document.querySelector("#settingsInboxPath");
const copyInboxPath = document.querySelector("#copyInboxPath");

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
let lastAutoClipboardText = "";

const settings = {
  deviceName: localStorage.getItem("lanDrop.deviceName") || "",
  clipboardSync: localStorage.getItem("lanDrop.clipboardSync") === "true"
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

function authUrl(url) {
  return window.lanDropAccess ? window.lanDropAccess.withAccessUrl(url) : url;
}

function looksLikeUrl(text = "") {
  return /^https?:\/\/\S+$/i.test(text.trim());
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

function showView(id) {
  for (const view of views) view.hidden = view.id !== id;
  for (const button of viewButtons) {
    button.classList.toggle("active", button.dataset.viewTarget === id);
  }
  if (id === "clipboardView") renderClipboardHistory();
  if (id === "devicesView") loadDevices();
}

function applySettings() {
  if (deviceNameInput) deviceNameInput.value = settings.deviceName;
  if (clipboardSyncToggle) clipboardSyncToggle.checked = settings.clipboardSync;
  if (settingClipboardSync) settingClipboardSync.checked = settings.clipboardSync;
  if (accessLengthSetting) accessLengthSetting.value = "4";
  updateClipboardPolling();
}

function setClipboardSync(enabled) {
  settings.clipboardSync = Boolean(enabled);
  localStorage.setItem("lanDrop.clipboardSync", String(settings.clipboardSync));
  if (clipboardSyncToggle) clipboardSyncToggle.checked = settings.clipboardSync;
  if (settingClipboardSync) settingClipboardSync.checked = settings.clipboardSync;
  updateClipboardPolling();
}

function updateClipboardPolling() {
  if (clipboardPollTimer) {
    clearInterval(clipboardPollTimer);
    clipboardPollTimer = null;
  }
  if (!settings.clipboardSync || !isLocalAccess) return;
  clipboardPollTimer = setInterval(readClipboardSilently, 2500);
  readClipboardSilently();
}

async function readClipboardSilently() {
  if (!settings.clipboardSync || document.hidden) return;
  try {
    const text = (await readClipboardText()).trim();
    if (!text || text === lastAutoClipboardText) return;
    lastAutoClipboardText = text;
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

  for (const item of visibleItems) {
    const node = template.content.firstElementChild.cloneNode(true);
    const preview = node.querySelector(".preview");
    const title = node.querySelector("strong");
    const detail = node.querySelector(".item-detail");
    const typeBadge = node.querySelector(".item-type");
    const link = node.querySelector("a");
    const copyButton = node.querySelector(".copy-text");
    const deleteButton = node.querySelector(".delete-item");

    link.href = authUrl(item.url);
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "打开";
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
      typeBadge.textContent = isImage ? "图片" : "文件";
      detail.textContent = `${formatTime(item.createdAt)} · ${formatSize(item.size)} · ${item.filename}`;
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

    deleteButton.addEventListener("click", () => deleteItem(item));
    itemsEl.append(node);
  }
}

function renderClipboardHistory() {
  if (!clipboardHistory) return;
  clipboardHistory.innerHTML = "";
  const entries = items
    .filter((item) => item.type === "text" && (item.source === "clipboard" || looksLikeUrl(item.text)))
    .slice(0, 40);

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = "<strong>还没有剪贴板内容</strong><span>复制文字或链接后，开启实时监听或点击发送剪贴板。</span>";
    clipboardHistory.append(empty);
    return;
  }

  for (const item of entries) {
    const row = document.createElement("article");
    row.className = "clipboard-history-item";
    const title = document.createElement("strong");
    title.textContent = looksLikeUrl(item.text) ? "链接" : "文字";
    const body = document.createElement("p");
    body.textContent = item.text;
    const meta = document.createElement("span");
    meta.textContent = formatTime(item.createdAt);
    const actions = document.createElement("div");
    actions.className = "clipboard-history-actions";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "secondary";
    copy.textContent = "复制";
    copy.addEventListener("click", () => copyText(item.text, copy));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "删除";
    remove.addEventListener("click", () => deleteItem(item));
    actions.append(copy, remove);
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
    detail.textContent = `${device.ip || "未知 IP"} · 最后访问 ${formatRelativeTime(device.lastSeenAt)}`;
    meta.append(title, detail);

    const status = document.createElement("span");
    status.className = device.active ? "device-status active" : "device-status";
    status.textContent = device.active ? "在线" : device.revokedAt ? "已踢出" : "离线";

    const kick = document.createElement("button");
    kick.type = "button";
    kick.className = "danger";
    kick.textContent = "踢出";
    kick.disabled = Boolean(device.revokedAt) && !device.active;
    kick.addEventListener("click", () => revokeDevice(device));

    row.append(meta, status, kick);
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
  if (!confirm(`踢出“${device.name || "这台设备"}”？它需要重新输入访问码才能访问。`)) return;
  const response = await fetch(`/api/devices/${encodeURIComponent(device.id)}`, { method: "DELETE" });
  if (!response.ok) {
    showStatus("踢出设备失败", "error");
    return;
  }
  const data = await response.json();
  devices = data.devices || [];
  renderDevices();
  showStatus("已踢出设备", "ok");
}

function renderUpdateResult(data) {
  if (!updatePanel || !updateSummary || !updateActions) return;
  updateActions.innerHTML = "";
  const current = data.currentVersion || appVersion || "未知";

  if (data.updateAvailable) {
    const version = data.name || data.tagName || "新版本";
    updateSummary.textContent = `发现 ${version}，当前版本 v${current}。建议下载新版安装包后覆盖安装。`;
  } else {
    updateSummary.textContent = `当前版本 v${current}，已经是最新可用版本。`;
  }

  const assets = [data.recommendedAsset, data.windowsAsset, data.macAsset]
    .filter(Boolean)
    .filter((asset, index, list) => list.findIndex((item) => item.name === asset.name) === index);

  for (const asset of assets) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `下载 ${updateAssetLabel(asset)}`;
    button.title = asset.name || "";
    button.addEventListener("click", () => {
      window.open(asset.browserDownloadUrl, "_blank", "noopener");
    });
    updateActions.append(button);
  }

  if (data.htmlUrl) {
    const openRelease = document.createElement("button");
    openRelease.type = "button";
    openRelease.className = "secondary";
    openRelease.textContent = "打开发布页";
    openRelease.addEventListener("click", () => window.open(data.htmlUrl, "_blank", "noopener"));
    updateActions.append(openRelease);

    const copyLink = document.createElement("button");
    copyLink.type = "button";
    copyLink.className = "ghost";
    copyLink.textContent = "复制下载页";
    copyLink.addEventListener("click", () => copyText(data.htmlUrl, copyLink));
    updateActions.append(copyLink);
  }
}

for (const button of viewButtons) {
  button.addEventListener("click", () => showView(button.dataset.viewTarget));
}

document.querySelector('a[href="#dropZone"]')?.addEventListener("click", () => showView("transferView"));
document.querySelector('a[href="#receivedFeed"]')?.addEventListener("click", () => showView("transferView"));
document.querySelector('a[href="#clipboardPanel"]')?.addEventListener("click", () => showView("clipboardView"));

clipboardSyncToggle?.addEventListener("change", () => {
  setClipboardSync(clipboardSyncToggle.checked);
  setClipboardHint(clipboardSyncToggle.checked ? "实时监听已开启。复制新文字后会自动记录。" : "实时监听已关闭。", "info");
});

settingClipboardSync?.addEventListener("change", () => {
  setClipboardSync(settingClipboardSync.checked);
});

deviceNameInput?.addEventListener("input", () => {
  settings.deviceName = deviceNameInput.value.trim();
  localStorage.setItem("lanDrop.deviceName", settings.deviceName);
});

copyInboxPath?.addEventListener("click", () => {
  if (!inboxDirectory) return showStatus("还没有读取到保存目录", "error");
  copyText(inboxDirectory, copyInboxPath);
});

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
    if (!quiet) showStatus(data.updateAvailable ? "发现新版本" : "当前已是最新版本", "ok");
  } catch (error) {
    if (updateSummary) updateSummary.textContent = `检查更新失败：${error.message}。可以稍后重试，或手动打开 GitHub Releases。`;
    updateActions.innerHTML = "";
    const openRelease = document.createElement("button");
    openRelease.type = "button";
    openRelease.className = "secondary";
    openRelease.textContent = "打开下载页";
    openRelease.addEventListener("click", () => {
      window.open("https://github.com/t01094738688-commits/lan-drop/releases", "_blank", "noopener");
    });
    updateActions.append(openRelease);
    if (!quiet) showStatus("检查更新失败", "error");
  } finally {
    checkUpdate.disabled = false;
    checkUpdate.textContent = original || "检查更新";
  }
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
}

async function deleteItem(item) {
  if (!confirm(`删除“${item.name || item.filename}”？`)) return;
  const response = await fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    showStatus(data.error || "删除失败", "error");
    return;
  }
  items = items.filter((entry) => entry.id !== item.id);
  render();
  showStatus("已删除", "ok");
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
    setClipboardHint("已从剪贴板发送图片/截图", "ok");
  } else if (text && ![textInput, clipboardInput].includes(document.activeElement)) {
    event.preventDefault();
    try {
      await postItem({ type: "text", text, source: "clipboard" });
      showStatus("已发送剪贴板文字", "ok");
    } catch (error) {
      showStatus(error.message, "error");
    }
  }
});

clipboardInput?.addEventListener("input", resizeClipboardInput);

readClipboard?.addEventListener("click", async () => {
  try {
    const text = await readClipboardText();
    if (!text.trim()) {
      setClipboardHint("剪贴板里没有可读取的文字。", "error");
      return;
    }
    clipboardInput.value = text;
    resizeClipboardInput();
    setClipboardHint(looksLikeUrl(text) ? "已读取链接，可以发送到手机。" : "已读取文字，可以发送到手机。", "ok");
  } catch {
    setClipboardHint("浏览器不允许直接读取剪贴板，可以手动 Ctrl + V 粘贴。", "error");
    clipboardInput.focus();
  }
});

sendClipboard?.addEventListener("click", async () => {
  const text = clipboardInput.value.trim();
  if (!text) {
    setClipboardHint("先粘贴或读取一段文字/链接。", "error");
    clipboardInput.focus();
    return;
  }
  try {
    await postItem({ type: "text", text, source: "clipboard" });
    clipboardInput.value = "";
    resizeClipboardInput();
    setClipboardHint("已发送到收到内容列表，手机端可复制。", "ok");
    showStatus("剪贴板内容已发送", "ok");
  } catch (error) {
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

checkUpdate?.addEventListener("click", () => checkForUpdates());

async function boot() {
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
  if (!isLocalAccess) {
    serviceStatus.textContent = "已连接电脑，可以发送文件、图片和文字";
    serviceStatus.dataset.state = "ok";
  }
  renderDevices();
  appVersion = info.version || "";
  if (versionBadge && appVersion) versionBadge.textContent = `v${appVersion}`;
  if (updatePanel) updatePanel.hidden = !isLocalAccess;
  if (updateSummary && appVersion) updateSummary.textContent = `当前版本 v${appVersion}。点击检查更新，可直接下载最新版安装包。`;
  applySettings();
  phoneUrls = info.urls || [];
  phoneUrl = phoneUrls[0] || location.href;
  recommendedUrl.textContent = phoneUrl;
  if (qrCode && phoneUrls.length) {
    qrCode.src = `/api/qr?text=${encodeURIComponent(phoneUrl)}`;
    qrCode.hidden = false;
  }
  currentAccessCode = info.accessCode || "";
  accessCodeValue.textContent = currentAccessCode || "远程设备输入后可使用";
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
  await loadDevices();
  if (isLocalAccess) setTimeout(() => checkForUpdates({ quiet: true }), 800);

  const events = new EventSource(authUrl("/api/events"));
  events.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "deleted") {
      items = items.filter((entry) => entry.id !== payload.id);
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

