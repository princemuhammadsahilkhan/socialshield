let warningBanner = null;
let lastAnalyzedText = "";
let autoScanTimeout = null;

function extractPageText() {
  const selectors = [
    "main", "article", ".email-body", "#message-body",
    "[role='main']", ".content", "body"
  ];
  
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText || el.textContent || "";
      if (text.length > 100) return text.trim();
    }
  }
  return document.body.innerText || "";
}

function autoScan() {
  const text = extractPageText();
  if (!text || text.length < 100) return;
  if (text === lastAnalyzedText) return;
  lastAnalyzedText = text;

  chrome.runtime.sendMessage({ type: "ANALYZE_TEXT", text }, (response) => {
    if (!response || response.error) return;
    if (response.analysis && response.analysis.risk_level !== "SAFE") {
      injectWarningBanner(response.analysis);
    }
  });
}

function extractPageText() {
  const selectors = [
    "main", "article", ".email-body", "#message-body",
    "[role='main']", ".content", "body"
  ];
  
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText || el.textContent || "";
      if (text.length > 100) return text.trim();
    }
  }
  return document.body.innerText || "";
}

function removeWarningBanner() {
  if (warningBanner) {
    warningBanner.remove();
    warningBanner = null;
  }
}

function getRiskColor(level) {
  const colors = {
    SAFE: { bg: "#0d1f0d", border: "#22c55e", accent: "#22c55e", text: "#86efac" },
    LOW:  { bg: "#1a1a0a", border: "#eab308", accent: "#eab308", text: "#fde047" },
    MEDIUM: { bg: "#1a0f00", border: "#f97316", accent: "#f97316", text: "#fdba74" },
    HIGH:   { bg: "#1a0505", border: "#ef4444", accent: "#ef4444", text: "#fca5a5" },
    CRITICAL: { bg: "#120010", border: "#a855f7", accent: "#a855f7", text: "#d8b4fe" }
  };
  return colors[level] || colors.LOW;
}

function getRiskEmoji(level) {
  return { SAFE: "✓", LOW: "⚠", MEDIUM: "⚠", HIGH: "✕", CRITICAL: "☠" }[level] || "⚠";
}

function injectWarningBanner(analysis) {
  removeWarningBanner();
  
  if (analysis.risk_level === "SAFE") return;

  const colors = getRiskColor(analysis.risk_level);
  const emoji = getRiskEmoji(analysis.risk_level);

  const banner = document.createElement("div");
  banner.id = "socialshield-banner";
  banner.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    width: 340px;
    max-height: 80vh;
    overflow-y: auto;
    background: ${colors.bg};
    border: 1.5px solid ${colors.border};
    border-radius: 12px;
    padding: 16px;
    z-index: 2147483647;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #e2e8f0;
    box-shadow: 0 0 24px ${colors.border}44, 0 4px 32px rgba(0,0,0,0.8);
    animation: ssSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  const tacticsList = analysis.tactics_detected.map(t => `
    <div style="margin-top:10px;padding:10px;background:rgba(255,255,255,0.04);border-left:2px solid ${colors.accent};border-radius:0 6px 6px 0;">
      <div style="color:${colors.text};font-weight:bold;font-size:11px;letter-spacing:0.08em;">${t.tactic.replace(/_/g, " ")}</div>
      <div style="color:#94a3b8;margin-top:4px;font-style:italic;">"${t.evidence.slice(0, 80)}${t.evidence.length > 80 ? '...' : ''}"</div>
      <div style="color:#cbd5e1;margin-top:4px;">${t.explanation}</div>
    </div>
  `).join("");

  banner.innerHTML = `
    <style>
      @keyframes ssSlideIn {
        from { opacity: 0; transform: translateX(20px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      #socialshield-banner::-webkit-scrollbar { width: 4px; }
      #socialshield-banner::-webkit-scrollbar-track { background: transparent; }
      #socialshield-banner::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 2px; }
    </style>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:28px;height:28px;border-radius:6px;background:${colors.border};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;color:#000;">${emoji}</div>
        <div>
          <div style="color:${colors.text};font-weight:bold;font-size:13px;letter-spacing:0.06em;">SOCIALSHIELD</div>
          <div style="color:${colors.accent};font-size:10px;letter-spacing:0.12em;">${analysis.risk_level} RISK · ${analysis.risk_score}/100</div>
        </div>
      </div>
      <button onclick="document.getElementById('socialshield-banner').remove()" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px;" title="Dismiss">✕</button>
    </div>
    
    <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;margin-bottom:10px;color:#cbd5e1;line-height:1.5;">
      ${analysis.summary}
    </div>

    <div style="color:${colors.text};font-size:10px;letter-spacing:0.1em;font-weight:bold;margin-bottom:4px;">TACTICS DETECTED (${analysis.tactics_detected.length})</div>
    ${tacticsList}

    <div style="margin-top:12px;padding:10px;background:${colors.border}22;border-radius:8px;border:1px solid ${colors.border}44;">
      <div style="color:${colors.text};font-size:10px;letter-spacing:0.1em;font-weight:bold;margin-bottom:4px;">RECOMMENDATION</div>
      <div style="color:#e2e8f0;">${analysis.recommendation}</div>
    </div>

    <div style="margin-top:10px;text-align:center;color:#475569;font-size:10px;">SocialShield · MITRE ATT&CK aligned</div>
  `;

  document.body.appendChild(banner);
  warningBanner = banner;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PAGE_TEXT") {
    const text = extractPageText();
    sendResponse({ text, url: window.location.href, title: document.title });
    return true;
  }

  if (message.type === "SHOW_ANALYSIS") {
    injectWarningBanner(message.analysis);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "CLEAR_BANNER") {
    removeWarningBanner();
    sendResponse({ success: true });
    return true;
  }
});

// Auto-scan page after it fully loads — wait 2 seconds for dynamic content
if (document.readyState === "complete") {
  autoScanTimeout = setTimeout(autoScan, 2000);
} else {
  window.addEventListener("load", () => {
    autoScanTimeout = setTimeout(autoScan, 2000);
  });
}

// ===== DEVIL MODE =====
let devilModeEnabled = false;

const FAKE_DATA = {
  text:     () => ["john.doe@gmail.com","ahmed.khan123@yahoo.com","user_test_99@outlook.com"][Math.floor(Math.random()*3)],
  email:    () => ["john.doe@gmail.com","ahmed.khan123@yahoo.com","fakeemail_"+Math.floor(Math.random()*9999)+"@gmail.com"][Math.floor(Math.random()*3)],
  password: () => ["P@ssw0rd123!","Secure#2024","MyPass_"+Math.floor(Math.random()*9999)][Math.floor(Math.random()*3)],
  tel:      () => ["03001234567","03211234567","03331234567"][Math.floor(Math.random()*3)],
  number:   () => String(Math.floor(Math.random()*9000000000)+1000000000),
  default:  () => "test_"+Math.floor(Math.random()*99999)
};

function getFakeValue(input) {
  const type = (input.type || "").toLowerCase();
  const name = (input.name + " " + input.placeholder + " " + input.id).toLowerCase();
  if (type === "email" || name.includes("email")) return FAKE_DATA.email();
  if (type === "password" || name.includes("pass")) return FAKE_DATA.password();
  if (type === "tel" || name.includes("phone") || name.includes("mobile")) return FAKE_DATA.tel();
  if (name.includes("cnic") || name.includes("account") || name.includes("card")) return FAKE_DATA.number();
  if (type === "text") return FAKE_DATA.text();
  return FAKE_DATA.default();
}

function poisonForms() {
  const forms = document.querySelectorAll("form");
  let poisoned = false;
  forms.forEach(form => {
    const inputs = form.querySelectorAll("input:not([type='submit']):not([type='button']):not([type='hidden']):not([type='checkbox']):not([type='radio'])");
    if (inputs.length > 0) {
      inputs.forEach(input => {
        const fake = getFakeValue(input);
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeSetter.call(input, fake);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      poisoned = true;
    }
  });
  return poisoned;
}

function fingerprintPage() {
  const forms = document.querySelectorAll("form");
  const scripts = Array.from(document.querySelectorAll("script[src]"))
    .map(s => s.src)
    .filter(s => !s.includes(window.location.hostname))
    .slice(0, 5);

  let formAction = null;
  let inputCount = 0;

  forms.forEach(form => {
    if (form.action) formAction = form.action;
    inputCount += form.querySelectorAll("input").length;
  });

  return { formAction, scripts, inputCount, url: window.location.href, hostname: window.location.hostname };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SET_DEVIL_MODE") {
    devilModeEnabled = message.enabled;
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "DEVIL_MODE") {
    const fp = fingerprintPage();
    const poisoned = poisonForms();
    sendResponse({ fingerprint: fp, poisoned });
    return true;
  }
});
