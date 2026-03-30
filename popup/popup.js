let stats = { threats: 0, poisoned: 0, scans: 0 };
let intelLog = [];
let devilMode = false;

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  document.getElementById("panel-" + tab).classList.add("active");
}

function getRiskColors(level) {
  return {
    SAFE:     { color:"#00ff88", bg:"#00ff8812", border:"#00ff8830" },
    LOW:      { color:"#ffe500", bg:"#ffe50012", border:"#ffe50030" },
    MEDIUM:   { color:"#ff6b35", bg:"#ff6b3512", border:"#ff6b3530" },
    HIGH:     { color:"#ff2d55", bg:"#ff2d5512", border:"#ff2d5530" },
    CRITICAL: { color:"#ff2d55", bg:"#1a0508",   border:"#ff2d5550" }
  }[level] || { color:"#4a5568", bg:"transparent", border:"#1a2035" };
}

function updateStats() {
  document.getElementById("statThreats").textContent = stats.threats;
  document.getElementById("statPoison").textContent  = stats.poisoned;
  document.getElementById("statScans").textContent   = stats.scans;
}

function renderIntel() {
  const el = document.getElementById("intelContent");
  if (intelLog.length === 0) {
    el.innerHTML = `<div class="intel-empty"><div class="big">⬡</div><p>No threat intelligence yet.<br>Scan pages to build your intel feed.</p></div>`;
    return;
  }
  const cards = intelLog.slice().reverse().map(item => `
    <div class="threat-card ${item.risk}">
      <div class="threat-url">${item.url}</div>
      <div class="threat-meta">
        <div class="threat-meta-item">RISK <span>${item.risk}</span></div>
        <div class="threat-meta-item">SCORE <span>${item.score}/100</span></div>
        <div class="threat-meta-item">TACTICS <span>${item.tactics}</span></div>
        <div class="threat-meta-item">TIME <span>${item.time}</span></div>
      </div>
      ${item.forms > 0 ? `<div class="threat-meta" style="margin-top:4px"><div class="threat-meta-item">FORMS <span>${item.forms}</span></div><div class="threat-meta-item">SCRIPTS <span>${item.scripts}</span></div></div>` : ""}
      ${item.poisoned ? `<div class="poison-badge">☠ POISONED — fake data injected</div>` : ""}
    </div>`).join("");
  el.innerHTML = cards + `<button class="clear-btn" id="clearIntelBtn">CLEAR INTEL LOG</button>`;
  document.getElementById("clearIntelBtn").addEventListener("click", () => {
    intelLog = [];
    chrome.storage.local.set({ intelLog });
    renderIntel();
  });
}

function renderResult(analysis, url, fingerprint, poisoned) {
  const area = document.getElementById("resultArea");
  if (analysis.risk_level === "SAFE") {
    area.innerHTML = `<div class="safe-box"><div class="safe-icon">✓</div><div class="safe-title">NO THREATS DETECTED</div><div class="safe-sub">Score: ${analysis.risk_score}/100 · Clean</div></div>`;
    return;
  }

  const c = getRiskColors(analysis.risk_level);
  const tacticsHTML = analysis.tactics_detected.map(t => `
    <div class="tactic-chip" style="border-color:${c.color}">
      <div class="tactic-name" style="color:${c.color}">${t.tactic.replace(/_/g," ")}</div>
      <div class="tactic-evidence">"${t.evidence.slice(0,80)}${t.evidence.length>80?"...":""}"</div>
      <div class="tactic-why">${t.explanation}</div>
    </div>`).join("");

  let devilHTML = "";
  if (devilMode && (fingerprint || poisoned)) {
    const fpItems = fingerprint ? [
      fingerprint.formAction ? `<div class="devil-action-item"><span class="devil-bullet">▸</span>Form endpoint: <span style="color:#00f5ff;margin-left:4px">${fingerprint.formAction.slice(0,50)}</span></div>` : "",
      fingerprint.scripts?.length ? `<div class="devil-action-item"><span class="devil-bullet">▸</span>Scripts detected: <span style="color:#e8eaf0;margin-left:4px">${fingerprint.scripts.length} external</span></div>` : "",
      fingerprint.inputCount ? `<div class="devil-action-item"><span class="devil-bullet">▸</span>Input fields found: <span style="color:#e8eaf0;margin-left:4px">${fingerprint.inputCount}</span></div>` : "",
    ].filter(Boolean).join("") : "";

    devilHTML = `
      <div class="devil-action">
        <div class="devil-action-title">☠ DEVIL MODE ACTIVATED</div>
        ${poisoned ? `<div class="devil-action-item"><span class="devil-bullet">▸</span><span style="color:#ff2d55">POISONED</span> — fake credentials injected into attacker forms</div>` : ""}
        ${fpItems}
        ${!fingerprint?.formAction && !poisoned ? `<div class="devil-action-item"><span class="devil-bullet">▸</span>No injectable forms found on this page</div>` : ""}
      </div>`;
  }

  area.innerHTML = `
    <div class="result-card" style="border-color:${c.border}">
      <div class="result-header" style="background:${c.bg};border-bottom:1px solid ${c.border}">
        <div class="risk-label" style="color:${c.color}">${analysis.risk_level}</div>
        <div class="score-track"><div class="score-fill" style="width:${analysis.risk_score}%;background:${c.color}"></div></div>
        <div class="score-val" style="color:${c.color}">${analysis.risk_score}/100</div>
      </div>
      <div class="result-body">
        <div class="summary-text">${analysis.summary}</div>
        ${analysis.tactics_detected.length > 0 ? `<div class="section-title">TACTICS (${analysis.tactics_detected.length})</div>${tacticsHTML}` : ""}
        <div class="recommend" style="background:${c.bg};border-color:${c.border}">
          <div class="recommend-title" style="color:${c.color}">RECOMMENDATION</div>
          <div style="color:#e8eaf0">${analysis.recommendation}</div>
        </div>
        ${devilHTML}
      </div>
    </div>`;
}

function showLoading(msg) {
  document.getElementById("resultArea").innerHTML = `
    <div class="loading">
      <div class="loading-ring"></div>
      <div class="loading-text">${msg}</div>
      <div class="loading-sub">Running analysis...</div>
    </div>`;
}

function showError(msg) {
  document.getElementById("resultArea").innerHTML = `<div class="error-box">⚠ ${msg}</div>`;
}

function analyzeText() {
  const text = document.getElementById("scanInput").value.trim();
  if (!text) { showError("Paste some text to analyze."); return; }
  showLoading("Analyzing text...");
  document.getElementById("analyzeBtn").disabled = true;
  stats.scans++;
  updateStats();

  chrome.runtime.sendMessage({ type: "ANALYZE_TEXT", text }, (response) => {
    document.getElementById("analyzeBtn").disabled = false;
    if (!response || response.error === "NO_API_KEY") { showError("No API key. Go to CONFIG tab."); return; }
    if (response.error) { showError("Error: " + response.error); return; }
    const a = response.analysis;
    if (a.risk_level !== "SAFE") { stats.threats++; updateStats(); }
    renderResult(a, null, null, false);
  });
}

function scanPage() {
  showLoading("Extracting page...");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) { showError("No active tab."); return; }
    chrome.tabs.sendMessage(tabs[0].id, { type: "GET_PAGE_TEXT" }, (response) => {
      if (chrome.runtime.lastError || !response) { showError("Cannot access this page. Try a regular webpage."); return; }
      const text = response.text;
      const url  = response.url;
      document.getElementById("scanInput").value = text.slice(0, 1500);
      showLoading("AI analyzing...");
      stats.scans++;
      updateStats();

      chrome.runtime.sendMessage({ type: "ANALYZE_TEXT", text }, (res) => {
        if (!res || res.error === "NO_API_KEY") { showError("No API key. Go to CONFIG tab."); return; }
        if (res.error) { showError("Error: " + res.error); return; }
        const a = res.analysis;
        if (a.risk_level !== "SAFE") {
          stats.threats++;
          updateStats();
          chrome.tabs.sendMessage(tabs[0].id, { type: "SHOW_ANALYSIS", analysis: a });

          if (devilMode) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "DEVIL_MODE", riskLevel: a.risk_level }, (devilRes) => {
              const fp = devilRes?.fingerprint || null;
              const poisoned = devilRes?.poisoned || false;
              if (poisoned) { stats.poisoned++; updateStats(); }
              logIntel(url, a, fp, poisoned);
              renderResult(a, url, fp, poisoned);
            });
          } else {
            logIntel(url, a, null, false);
            renderResult(a, url, null, false);
          }
        } else {
          renderResult(a, url, null, false);
        }
      });
    });
  });
}

function logIntel(url, analysis, fingerprint, poisoned) {
  const entry = {
    url: url || "manual scan",
    risk: analysis.risk_level,
    score: analysis.risk_score,
    tactics: analysis.tactics_detected.length,
    forms: fingerprint?.inputCount || 0,
    scripts: fingerprint?.scripts?.length || 0,
    poisoned,
    time: new Date().toLocaleTimeString()
  };
  intelLog.push(entry);
  chrome.storage.local.set({ intelLog });
  renderIntel();
}

function saveKey() {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) return;
  chrome.runtime.sendMessage({ type: "SAVE_API_KEY", key }, () => {
    document.getElementById("savedToast").classList.add("show");
    document.getElementById("keyStatus").textContent = "ONLINE";
    setTimeout(() => document.getElementById("savedToast").classList.remove("show"), 2500);
  });
}

function toggleKeyVisibility() {
  const inp = document.getElementById("apiKeyInput");
  inp.type = inp.type === "password" ? "text" : "password";
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.runtime.sendMessage({ type: "GET_API_KEY" }, (res) => {
    if (res?.key) {
      document.getElementById("apiKeyInput").value = res.key;
      document.getElementById("keyStatus").textContent = "ONLINE";
    }
  });

  chrome.storage.local.get(["intelLog", "stats", "devilMode"], (data) => {
    if (data.intelLog) { intelLog = data.intelLog; renderIntel(); }
    if (data.stats) { stats = data.stats; updateStats(); }
    if (data.devilMode) {
      devilMode = data.devilMode;
      document.getElementById("devilToggle").checked = devilMode;
      document.getElementById("devilStatus").textContent = devilMode ? "ON" : "OFF";
      document.getElementById("devilStatus").classList.toggle("on", devilMode);
    }
  });

  document.getElementById("tab-scan").addEventListener("click", () => switchTab("scan"));
  document.getElementById("tab-intel").addEventListener("click", () => switchTab("intel"));
  document.getElementById("tab-settings").addEventListener("click", () => switchTab("settings"));
  document.getElementById("analyzeBtn").addEventListener("click", analyzeText);
  document.getElementById("scanPageBtn").addEventListener("click", scanPage);
  document.getElementById("saveKeyBtn").addEventListener("click", saveKey);
  document.getElementById("toggleEyeBtn").addEventListener("click", toggleKeyVisibility);

  document.getElementById("devilToggle").addEventListener("change", (e) => {
    devilMode = e.target.checked;
    chrome.storage.local.set({ devilMode });
    const s = document.getElementById("devilStatus");
    s.textContent = devilMode ? "ON" : "OFF";
    s.classList.toggle("on", devilMode);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: "SET_DEVIL_MODE", enabled: devilMode });
    });
  });

  document.getElementById("scanInput").addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") analyzeText();
  });
});
