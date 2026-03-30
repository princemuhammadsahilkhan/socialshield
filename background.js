const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const SYSTEM_PROMPT = `You are SocialShield, an expert cybersecurity AI trained to detect social engineering and phishing attacks in real time.

Analyze the given text and detect ANY of these manipulation tactics:

TACTIC TAXONOMY (based on MITRE ATT&CK):
1. URGENCY_INJECTION - Creating artificial time pressure ("act now", "expires in 24h", "immediate action required")
2. AUTHORITY_SPOOFING - Impersonating authority figures, companies, or institutions ("your bank", "Microsoft support", "IRS", "CEO")
3. FEAR_PRESSURE - Using fear, threats, or consequences to compel action ("your account will be suspended", "legal action", "you owe money")
4. SCARCITY_TACTIC - Fake limited availability ("only 3 left", "limited offer", "last chance")
5. REWARD_LURE - Fake prizes, rewards, or too-good-to-be-true offers ("you won", "claim your gift", "free money")
6. CREDENTIAL_HARVESTING - Requesting sensitive info suspiciously (passwords, OTPs, card numbers, SSN)
7. PRETEXTING - Fabricating a scenario to manipulate ("we noticed unusual activity", "your package is waiting")
8. TRUST_BUILDING - Excessive trust signals before a suspicious ask ("as your friend", "we care about you", "no strings attached")
9. SOCIAL_PROOF - Fake consensus to pressure ("everyone is doing it", "thousands already claimed")
10. ISOLATION_TACTIC - Discouraging verification ("don't tell anyone", "this is confidential", "call us directly only")

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation):
{
  "risk_level": "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "risk_score": <0-100>,
  "tactics_detected": [
    {
      "tactic": "<TACTIC_NAME>",
      "evidence": "<exact phrase or sentence from text that triggered this>",
      "explanation": "<1 sentence why this is suspicious>"
    }
  ],
  "summary": "<2 sentence plain English summary of what this text is trying to do>",
  "recommendation": "<one clear action the user should take>"
}

If no tactics are detected, return risk_level "SAFE", risk_score 0, empty tactics_detected array.`;

async function analyzeText(text, apiKey) {
  const truncated = text.slice(0, 3000);
  
  const body = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT + "\n\nText to analyze:\n" + truncated }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024
    }
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "API request failed");
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_TEXT") {
    chrome.storage.sync.get(["geminiApiKey"], async (result) => {
      if (!result.geminiApiKey) {
        sendResponse({ error: "NO_API_KEY" });
        return;
      }
      try {
        const analysis = await analyzeText(message.text, result.geminiApiKey);
        sendResponse({ success: true, analysis });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    });
    return true;
  }

  if (message.type === "SAVE_API_KEY") {
    chrome.storage.sync.set({ geminiApiKey: message.key }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "GET_API_KEY") {
    chrome.storage.sync.get(["geminiApiKey"], (result) => {
      sendResponse({ key: result.geminiApiKey || "" });
    });
    return true;
  }
});
