# Wedora 🪔

**Run your family's wedding like a team — in your own language.** Grandma speaks Odia, the uncle in Kolkata speaks Bengali, and the work still lands with the right person.

> Built in one day at **Festive Hacks** (WeMakeDevs × WeAreDevelopers, BIEC Bengaluru, 25 Nov 2026) with **Sarvam AI**, **Flagsmith** and **NudgeBee**.

| | |
|---|---|
| 🎥 Demo video | _coming before submission_ |
| 🌐 Live web app | **https://yubaraj2000.github.io/wedora/** (opens in any browser; no install) |
| 📱 Android APK | Release APK (arm64, sideload): see the latest [GitHub release](https://github.com/yubaraj2000/wedora/releases) |

---

## The problem

An Indian wedding is run by 20–40 relatives at once: someone books the tent, someone pays the caterer, someone tracks the guest list. Today this lives in one noisy WhatsApp group:

- Nobody knows **who approved** a ₹12,000 payment, or whether anyone did.
- Every message pings everyone, so the important ones get lost.
- The elders who know the most can't type English into an app.

## What Wedora does

- **AI-guided setup in your language.** The Family Admin picks ଓଡ଼ିଆ / हिन्दी / বাংলা / English and Wedora — a calm wedding operations manager — **speaks each question aloud** and **takes spoken answers**: who is marrying, when and where, the budget ("୧୮ ଲକ୍ଷ" → ₹18,00,000), which ceremonies (suggested per tradition), starter tasks per department, and who heads each department (from phone contacts or typed). Every AI result is shown for confirmation before it is saved.
- **Invite-only family org chart.** One Family Admin, six departments (Finance, Logistics, Food & Catering, Decoration, Guest Management, Events & Ceremony), heads, sub-heads and members. Each WhatsApp invite link carries a department, a level and who sent it. **You can only invite people below you.** Heads get their own short onboarding, only about their department. The admin sees a live "Who joined" tree: who, at which level, invited by whom, and when.
- **Tasks and expenses with real approvals.** The approver depends on the amount: up to ₹5,000 the sub-head, up to ₹25,000 the department head, above that the Finance head. The limits are live config in Flagsmith, and every approval card says *why* it came to you ("₹12,000 > ₹5,000 sub-head limit → Head (Mamu), limits from Flagsmith"). Nobody can approve their own expense.
- **Talk with Wedora (hands-free).** Tap once and talk: *"Mamu tent wala ku baara hajaar deleni"* → "₹12,000 paid to the tent vendor. Shall I record it?" → *"ହଁ"* → "Recorded. Sent to Mamu (Head) for approval, as it is above ₹5,000." It stops listening when you pause, answers aloud, and listens again. It can also mark tasks done (with Undo) and answer "how much has Decoration spent?" from the database. **Money is always confirm-first.**
- **Notifications go only to the one person who must act** — your immediate head — not the whole family.

_The Mohanty family story used in the demo is illustrative._

## How each sponsor tool is used

### Sarvam AI — the voice of the app
| Sarvam API | Where in Wedora |
|---|---|
| Speech-to-text `saaras:v4` (language hint per member; Odia never mistaken for Marathi) | onboarding answers, voice commands, hands-free conversation |
| Chat `sarvam-105b` with strict JSON schemas | understanding wedding details, budgets, voice intents (expense / task / task status / status question / yes / no / stop), starter-task planning per ceremony |
| Translate | every AI line and UI label in the member's language |
| Text-to-speech Bulbul v4 (calm personas: `neha_en_customer`, `ritu_hi_customer`, `arnab_bn_conversation`; Odia via any v4 persona) | Wedora speaks every onboarding question and every reply |

The Sarvam key lives only in a Supabase Edge Function; the model only **proposes** actions — writes go through the same permission-checked database functions as the buttons, and rupee amounts are parsed by our own code ("12,000", "୧୮ ଲକ୍ଷ", "১২ হাজার").
**Without it:** relatives who can't type English are left out — the people the app is for.

### Flagsmith — the family's rulebook (per level, per language)
Every member is identified to Flagsmith **by the server, with traits read from the database** (`role`, `is_finance_head`, `language`), so nobody can fake their level.

| Flag | What it controls |
|---|---|
| `approval_limits` | ₹ limits for sub-heads/heads; read only on the server; each expense stores the limits it was routed with |
| `voice_expense` (segments per level) | who gets the voice assistant — on for admin/heads/sub-heads, **off for members until switched on live** (the server enforces it too) |
| `budget_dashboard`, `invite_people`, `ai_task_planner` (segments per level) | the hierarchy's powers: dashboard for admin + Finance head, invites for leaders, AI planning for admin + heads |
| `ceremony_suggestions` (segments per language) | Odia, Bengali and Hindi ceremony lists in their own scripts, editable in Flagsmith without a release |
| `ai_voice` | kill switch for all AI voice — NudgeBee flips it during an outage |
| `sarvam_model` | which Sarvam model to use |
| `sarvam_outage_drill` | makes the health check report Sarvam as down, to rehearse the NudgeBee runbook safely |

A **Live settings** card on Home shows the current flags; changes appear within ~10 s.
**Without it:** limits and powers would be hard-coded, and turning AI off during an outage would need a new release.

### NudgeBee — operating the app
**Automation `wedora-ai-outage-runbook`** (built with NudgeBee's nubi AI, then reviewed): every minute an HTTP task checks `…/functions/v1/wedora?op=health`; if `sarvam_ok` is false it raises an **in-app approval** for the operator; on approval it calls the Flagsmith API (admin key stored as a NudgeBee *secret* config) to switch `ai_voice` **off**, and stores a **HIGH** event. Families immediately get buttons instead of a broken mic.
**Without it:** a Sarvam outage means a broken mic in front of grandma at 11 pm the night before the wedding, and nobody on call notices.

## How it works

```
Expo app (Android + web)
   │  reads via Row-Level Security, writes only through checked functions
   ▼
Supabase: Postgres + RLS + Realtime + Edge Functions
   ├─ SECURITY DEFINER functions: create_invite, accept_invite, create_task, decide_expense …
   ├─ Edge Function submit-expense ──► Flagsmith (server key): approval_limits
   └─ Edge Function voice (Layer 2) ──► Sarvam STT → sarvam-105b tools → TTS
NudgeBee runbook ──► ai-health ──► Flagsmith ai_voice
```

Security rule: **feature flags are never security.** Roles, invite levels and approvals are enforced in Postgres (RLS + functions). Flags only tune limits and switch features.

## Try it locally

Requirements: Node 20+, a Supabase project, a Flagsmith environment, a Sarvam API key.

1. `git clone https://github.com/yubaraj2000/wedora && cd wedora && npm install`
2. `cp .env.example .env` and fill in your Supabase URL, Supabase publishable key and Flagsmith client key.
3. In the Supabase dashboard:
   - SQL editor → run `supabase/migrations/0001_core.sql`.
   - Authentication → Sign In / Providers → turn on **Allow anonymous sign-ins**.
   - Edge Functions → Secrets → add `SARVAM_API_KEY` and `FLAGSMITH_SERVER_KEY`.
4. In Flagsmith create the flags `approval_limits` (value `{"sub_head":5000,"head":25000}`), `ai_voice` (on) and `sarvam_model` (`sarvam-105b`).
5. `npx expo start` → press `w` for web, or scan the QR code with Expo Go.

Never commit `.env`; only `.env.example` is tracked.

## What is built / what is not

- [x] AI-guided admin onboarding by voice in Odia / Hindi / Bengali / English (spoken questions, spoken answers, confirm cards)
- [x] Invite-only joining with per-level invite rules, WhatsApp links, contact picker (Android), head/sub-head onboarding
- [x] Tasks, expenses routed by Flagsmith limits, approvals, admin dashboard, "Who joined" tree, notifications
- [x] Hands-free voice conversation with voice confirm, task status + Undo, spend questions
- [x] Flagsmith per-level and per-language flags, evaluated on the server
- [x] NudgeBee AI-outage runbook with human approval
- [x] Security audit fixes: RLS everywhere, write access only through checked functions, per-user AI quotas, CORS allowlist, secure session storage on phones, privacy notice, leave-wedding
- [x] Live web app (GitHub Pages) and Android release APK
- [ ] True streaming voice (Sarvam live speech-to-text over a WebSocket relay) — needs a development build; next step
- [ ] `onboarding_mode = classic_form` fallback (flag exists; the plain-form onboarding is not built yet)
- [ ] Head onboarding is text-first (spoken questions only in admin onboarding)

## Privacy and safety

- **What we keep:** each person's name and language, and the wedding's departments, tasks, expenses and notifications. Invite phone numbers are visible only to the person who sent the invite and the Family Admin, and are used only to open WhatsApp.
- **Voice:** recordings go to Sarvam AI (India) to be understood and are **not stored** by Wedora.
- **Minors:** cousins under 18 may join; the join screen asks them to check with a parent or guardian first (India's DPDP Act).
- **Leaving:** anyone except the Family Admin can "Leave this wedding" on Home — their name becomes "Former member", their notifications are deleted and their open invite links are revoked.
- **Security checks done before launch:** Row-Level Security on every table (read-only for the app; every change goes through role-checked database functions), no keys in the app or git history, per-user AI limits (40/min, 400/day) stored in Postgres, CORS limited to our own web origins, phone sessions in the secure keystore, unused email sign-up turned off. Tested with two accounts: no cross-wedding access, no self-promotion, no approving your own expense.

## Known limits

- Anonymous sign-in: if a relative clears the app's storage or reinstalls, they need a new invite.
- No CAPTCHA on anonymous sign-in yet (per-IP sign-up limits and per-user AI quotas apply).
- Illustrations are AI-generated in Google Flow and carry Flow's small visible watermark.

## Measured

Server timings from the deployed Edge Function (Sarvam, Mumbai/Tokyo regions, venue Wi-Fi):

| Step | Time |
|---|---|
| Odia speech → text (onboarding answer) | 0.3 s |
| Voice turn: speech-to-text + understanding (expense / yes / status / task done) | 1.0 – 2.1 s server time |
| Flagsmith flag change → app | about 10 s (polling) |
| Outage drill on → health check reports down | about 2 s |
| Release APK build (arm64) | about 3 min |

## AI tools used (disclosure)

This project was built during the hackathon by [yubaraj2000](https://github.com/yubaraj2000) with AI assistance, as allowed by the rules:

- **Claude Code** — wrote most of the code and SQL with me, set up the Supabase project and Flagsmith flags, and ran the builds. I reviewed and can explain every part.
- **Google Flow (Nano Banana 2.1)** — generated the Pattachitra-style illustrations and app icon.
- **Figma (via Claude Code)** — UI screen template.
- **NudgeBee nubi** — generated the runbook from a plain-English description, which we reviewed before building.
- **Parallel AI subagents** built independent screens from a shared typed API; every change was type-checked, linted and tested (119 unit tests) before commit. Voice code was written fresh from lessons learned earlier, not copied from earlier projects.

Before the event I only did research, sponsor account setup and the requirements notes; all code and design were made after hacking started at 11:30.

## License

MIT — see [LICENSE](LICENSE).
