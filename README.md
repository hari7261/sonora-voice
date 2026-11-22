# Sonora — Voice Infrastructure Website

A responsive, multipage Next.js + TypeScript website for the proposed Sonora speech API and embeddable voice-agent platform.

## Current state

This is a polished **front-end prototype**, not a deployed speech API. Interactive components are local demos, pricing is illustrative, and all API endpoints are proposed integration contracts. No Supabase project, OpenRouter key, Sherpa-ONNX model weights, DNS, payment integration or deployment credentials were provided, so none are falsely represented as connected.

## Stack

- Next.js App Router + TypeScript
- Pure CSS design system with dark and light themes
- Lucide icons
- Custom SVG editorial artwork
- No Python
- Production integration target: Supabase + OpenRouter + `sherpa-onnx-node` in a separately scalable Node.js inference process

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Production build: `npm run build && npm start`.

## Pages

- `/` — 14 major landing-page sections
- `/platform` — platform overview
- `/models` — model catalog
- `/models/[slug]` — five model detail pages
- `/agents` — voice agent and live editor preview
- `/api` — API overview
- `/docs` — quickstart, auth, STT, TTS, WS, language, embed, Next.js, credits, errors, security, production checklist
- `/pricing` — interactive indicative tiers
- `/faq` — FAQ and hardcoded bot with browser voice playback
- `/about`, `/contact` — supporting pages

## Next development steps

1. Set up Supabase Auth with RLS-scoped organizations, projects, API keys, quotas and immutable credit ledger.
2. Implement native Sherpa-ONNX inference in a long-running Node.js worker and run model license audits.
3. Implement the documented `/v1` API endpoints and WebSocket gateway with real audio frames.
4. Connect OpenRouter on server-side only with secret credentials and consent-aware conversation history.
5. Build tenant-aware agent publishing, production `voice-widget.js`, domain allowlists and short-lived tokens.
6. Add rate limiting, atomic credit accounting, audio security controls and operational observability.
7. Run accessibility and cross-browser tests; evaluate model accuracy per language before promising availability.

## Design

The design intentionally avoids stock AI gradients, sparkle illustrations, excessive animation, generic inflated copy, and unnecessary uniform cards. It uses steel-black headings in light mode, off-white headings in dark mode, editorial image compositions, structured technical previews, subtle terracotta accent, and typefaces Manrope, DM Sans and DM Mono.

## Disclaimer

An installed tool for directly authoring/deploying a website on a connected website-building service was not available in this session, so the deliverable is an editable Next.js source project. No build or browser preview was validated in this isolated runtime because npm dependencies were unavailable offline.