(function () {
  const originalFetch = window.fetch.bind(window);

  function withAccessUrl(url) {
    return url;
  }

  window.fetch = function (resource, init = {}) {
    return originalFetch(resource, init);
  };

  window.lanDropAccess = {
    getCode() {
      return "";
    },
    withAccessUrl,
    async status() {
      return originalFetch("/api/access/status").then((response) => response.json());
    }
  };

  function showGate() {
    if (document.querySelector(".access-gate")) return;
    const gate = document.createElement("div");
    gate.className = "access-gate";
    gate.innerHTML = `
      <form class="access-box">
        <div class="access-icon" aria-hidden="true">LAN</div>
        <h2>输入访问码</h2>
        <p>手机和电脑连接同一个 Wi-Fi 后，输入电脑端显示的访问码即可开始互传。</p>
        <input
          name="code"
          inputmode="text"
          autocomplete="one-time-code"
          autocapitalize="none"
          spellcheck="false"
          placeholder="输入电脑端访问码"
          required
        />
        <button type="submit">进入 LAN Drop</button>
        <span class="access-error" role="status"></span>
      </form>
    `;

    const form = gate.querySelector("form");
    const input = gate.querySelector("input");
    const error = gate.querySelector(".access-error");
    const button = gate.querySelector("button");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = new FormData(form).get("code").trim();
      if (!code) return;
      error.textContent = "";
      button.disabled = true;
      button.textContent = "正在进入...";
      const response = await originalFetch("/api/access/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      if (response.ok) {
        gate.remove();
        location.reload();
        return;
      }
      button.disabled = false;
      button.textContent = "进入 LAN Drop";
      error.textContent = response.status === 429
        ? "尝试次数过多，请稍后再试。"
        : "访问码不对，请刷新电脑端页面后重新输入。";
      input.select();
    });

    document.body.append(gate);
    setTimeout(() => input.focus(), 50);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const status = await window.lanDropAccess.status().catch(() => ({ ok: true }));
    if (!status.ok) showGate();
  });
})();
