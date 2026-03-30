# SocialShield 🛡️

> AI-powered browser extension that detects social engineering attacks in real time.

## What it detects
- Urgency Injection
- Authority Spoofing
- Fear Pressure
- Scarcity Tactics
- Reward Lures
- Credential Harvesting
- Pretexting
- Trust Building manipulation
- Social Proof abuse
- Isolation Tactics

All mapped to **MITRE ATT&CK** framework.

## Setup (Chrome)
1. Go to `chrome://extensions/`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked** → select this folder
4. Get a free Gemini API key at https://aistudio.google.com/app/apikey
5. Open the extension → Settings → paste your key → Save

## Usage
- **Paste text** → click Analyze
- **Scan Page** → analyzes the current webpage and injects a warning banner
- Ctrl+Enter shortcut to analyze

## Tech Stack
- Chrome Extension (Manifest V3)
- Gemini 1.5 Flash API (free tier: 1500 req/day)
- MITRE ATT&CK tactic taxonomy
- Zero backend — all client-side

## Hackathon Build
Built for cybersecurity hackathons. Open source, adoptable by enterprises.
