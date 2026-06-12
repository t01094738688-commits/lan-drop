(function () {
  const originalFetch = window.fetch.bind(window);

  function withAccessUrl(url) {
    return url;
  }

  window.fetch = function (resource, init = {}) {
    return originalFetch(resource, { credentials: "same-origin", ...init });
  };

  window.lanDropAccess = {
    getCode() {
      return "";
    },
    withAccessUrl,
    async status() {
      return originalFetch("/api/access/status", { credentials: "same-origin" })
        .then((response) => response.json());
    }
  };

  function showGate(accessCodeLength = 4) {
    if (document.querySelector(".access-gate")) return;
    const length = accessCodeLength === 6 ? 6 : 4;
    const gate = document.createElement("div");
    gate.className = "access-gate";
    gate.innerHTML = `
      <form class="access-box">
        <div class="access-icon" aria-hidden="true">LAN</div>
        <h2>输入访问码</h2>
        <p>访问码用于防止同一 Wi-Fi 下的陌生人打开你的电脑。请输入电脑端显示的 ${length} 位数字。</p>
        <input
          name="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          autocapitalize="none"
          spellcheck="false"
          maxlength="${length}"
          pattern="\\d{${length}}"
          placeholder="输入 ${length} 位访问码"
          required
        />
        <button type="submit">进入互传页面</button>
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
      const pattern = new RegExp(`^\\d{${length}}$`);
      if (!pattern.test(code)) {
        error.textContent = `请输入电脑端显示的 ${length} 位数字访问码。`;
        input.select();
        return;
      }
      error.textContent = "";
      button.disabled = true;
      button.textContent = "正在进入...";
      try {
        const response = await originalFetch("/api/access/unlock", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code })
        });
        if (response.ok) {
          gate.remove();
          location.reload();
          return;
        }
        error.textContent = response.status === 429
          ? "尝试次数过多，请稍后再试。"
          : "访问码不对，请刷新电脑端页面后重新输入。";
      } catch {
        error.textContent = "连接电脑失败，请确认手机和电脑在同一个 Wi-Fi。";
      } finally {
        button.disabled = false;
        button.textContent = "进入互传页面";
        input.select();
      }
    });

    document.body.append(gate);
    setTimeout(() => input.focus(), 50);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const status = await window.lanDropAccess.status().catch(() => ({
      ok: false,
      accessCodeLength: 4
    }));
    if (!status.ok) showGate(status.accessCodeLength);
  });
})();
