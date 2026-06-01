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
        <h2>输入访问码</h2>
        <p>同一 Wi-Fi 下的新设备需要访问码才能使用。</p>
        <input name="code" inputmode="text" autocomplete="one-time-code" autocapitalize="none" spellcheck="false" placeholder="输入电脑端显示的访问码" required />
        <button type="submit">进入</button>
        <span class="access-error"></span>
      </form>
    `;

    gate.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = new FormData(event.currentTarget).get("code").trim();
      const response = await originalFetch("/api/access/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      if (response.ok) {
        gate.remove();
        location.reload();
      } else {
        gate.querySelector(".access-error").textContent = "访问码不对，请刷新电脑端页面后重新输入。";
      }
    });
    document.body.append(gate);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const status = await window.lanDropAccess.status().catch(() => ({ ok: true }));
    if (!status.ok) showGate();
  });
})();
