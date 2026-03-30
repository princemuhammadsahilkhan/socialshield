function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  document.getElementById("panel-" + tab).classList.add("active");
}

function getRiskColors(level) {
  return {
    SAFE:     { color: "#22c55e", bg: "#22c55e18", border: "#22c55e44" },
    LOW:      { color: "#eab308", bg: "#eab30818", border: "#eab30844" },
    MEDIUM:   { color: "#f97316", bg: "#f9731618", border: "#f9731644" },
    HIGH:     { color: "#ef4444", bg: "#ef444418", border: "#ef444444" },
    CRITICAL: { color: "#a855f7", bg: "#a855f718", border: "#a855f744" }
  }[level] || { color: "#64748b", bg: "#64748b18", border: "#64748b44" };
}

function renderResult(analysis) {
  const area = document.getElementById("resultArea");

  if (analysis.risk_level === "SAFE") {
    area.innerHTML = `
      <div class="safe-card">
        <div class="safe-icon">✓</div>
        <div class="safe-title">NO THREATS DETECTED</div>
        <div class="safe-sub">Risk score: ${analysis.risk_score}/100 · Text appears safe</div>
      </div>`;
    return;
  }

  const c = getRiskColors(analysis.risk_level);

  const tacticsHTML = analysis.tactics_detected.map(t => `
    <div class="tactic-item" style="border-color:${c.color}">
      <div class="tactic-name" style="color:${c.color}">${t.tactic.replace(/_/g, " ")}</div>
      <div class="tactic-evidence">"${t.evidence.slice(0,90)}${t.evidence.length > 90 ? '...' : ''}"</div>
      <div class="tactic-explanation">${t.explanation}</div>
    </div>`).join("");

  area.innerHTML = `
    <div class="result-card">
      <div class="result-header" style="background:${c.bg};border-bottom:1px solid ${c.border}">
        <div class="risk-badge" style="background:${c.bg};border:1px solid ${c.border};color:${c.color}">${analysis.risk_level}</div>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width:${analysis.risk_score}%;background:${c.color}"></div>
        </div>
        <div class="score-num">${analysis.risk_score}/100</div>
      </div>
      <div class="result-body">
        <div class="result-summary">${analysis.summary}</div>
        ${analysis.tactics_detected.length > 0 ? `
          <div class="tactics-title">TACTICS DETECTED (${analysis.tactics_detected.length})</div>
          ${tacticsHTML}
        ` : ""}
        <div class="recommend-box" style="background:${c.bg};border-color:${c.border}">
          <div class="recommend-label" style="color:${c.color}">RECOMMENDATION</div>
          <div style="color:#e2e8f0">${analysis.recommendation}</div>
        </div>
      </div>
    </div>`;
}

function showLoading(msg) {
  document.getElementById("resultArea").innerHTML = `
    <div class="loading-state">
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <div class="loading-text">${msg}</div>
      <div class="loading-sub">Analyzing with Gemini AI...</div>
    </div>`;
}

function showError(msg) {
  document.getElementById("resultArea").innerHTML = `
    <div class="error-card">⚠ ${msg}</div>`;
}

async function analyzeText() {
  const text = document.getElementById("scanInput").value.trim();
  if (!text) { showError("Please paste some text to analyze."); return; }

  showLoading("Analyzing text...");
  document.getElementById("analyzeBtn").disabled = true;

  chrome.runtime.sendMessage({ type: "ANALYZE_TEXT", text }, (response) => {
    document.getElementById("analyzeBtn").disabled = false;
    if (response.error === "NO_API_KEY") {
      showError("No API key set. Go to Settings tab and add your Gemini API key.");
      return;
    }
    if (response.error) {
      showError("Error: " + response.error);
      return;
    }
    renderResult(response.analysis);
  });
}

async function scanPage() {
  showLoading("Extracting page content...");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) { showError("No active tab found."); return; }

    chrome.tabs.sendMessage(tabs[0].id, { type: "GET_PAGE_TEXT" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        showError("Cannot access this page. Try a regular webpage.");
        return;
      }

      const text = response.text;
      document.getElementById("scanInput").value = text.slice(0, 2000);

      showLoading("Scanning page with AI...");

      chrome.runtime.sendMessage({ type: "ANALYZE_TEXT", text }, (res) => {
        if (res.error === "NO_API_KEY") {
          showError("No API key set. Go to Settings and add your Gemini API key.");
          return;
        }
        if (res.error) { showError("Error: " + res.error); return; }

        renderResult(res.analysis);

        chrome.tabs.sendMessage(tabs[0].id, { type: "SHOW_ANALYSIS", analysis: res.analysis });
      });
    });
  });
}

function saveKey() {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) return;

  chrome.runtime.sendMessage({ type: "SAVE_API_KEY", key }, (response) => {
    if (response.success) {
      const toast = document.getElementById("savedToast");
      toast.classList.add("show");
      updateStatusPill(true);
      setTimeout(() => toast.classList.remove("show"), 2500);
    }
  });
}

function toggleKeyVisibility() {
  const input = document.getElementById("apiKeyInput");
  input.type = input.type === "password" ? "text" : "password";
}

function updateStatusPill(hasKey) {
  const pill = document.getElementById("statusPill");
  pill.textContent = hasKey ? "READY" : "NO KEY";
  pill.className = "status-pill " + (hasKey ? "ready" : "no-key");
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.runtime.sendMessage({ type: "GET_API_KEY" }, (response) => {
    if (response.key) {
      document.getElementById("apiKeyInput").value = response.key;
      updateStatusPill(true);
    }
  });

  document.getElementById("tab-scan").addEventListener("click", () => switchTab("scan"));
  document.getElementById("tab-settings").addEventListener("click", () => switchTab("settings"));
  document.getElementById("tab-about").addEventListener("click", () => switchTab("about"));

  document.getElementById("analyzeBtn").addEventListener("click", analyzeText);
  document.getElementById("scanPageBtn").addEventListener("click", scanPage);
  document.getElementById("saveKeyBtn").addEventListener("click", saveKey);
  document.getElementById("toggleEyeBtn").addEventListener("click", toggleKeyVisibility);

  document.getElementById("scanInput").addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") analyzeText();
  });
});
