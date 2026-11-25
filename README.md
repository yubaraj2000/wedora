# Wedora 🪔

**Run your family's wedding like a team — in your own language.** Grandma speaks Odia, the uncle in Kolkata speaks Bengali, and the work still lands with the right person.

> Built in one day at **Festive Hacks** (WeMakeDevs × WeAreDevelopers, BIEC Bengaluru, 25 Nov 2026) with **Sarvam AI**, **Flagsmith** and **NudgeBee**.

| | |
|---|---|
| 🎥 Demo video | _coming before submission_ |
| 🌐 Live web app | _coming before submission_ |
| 📱 Android APK | _optional, if time allows_ |

---

## The problem

An Indian wedding is run by 20–40 relatives at once: someone books the tent, someone pays the caterer, someone tracks the guest list. Today this lives in one noisy WhatsApp group:

- Nobody knows **who approved** a ₹12,000 payment, or whether anyone did.
- Every message pings everyone, so the important ones get lost.
- The elders who know the most can't type English into an app.

## What Wedora does

- **Invite-only family org chart.** One Family Admin, six departments (Finance, Logistics, Food & Catering, Decoration, Guest Management, Events & Ceremony), heads, sub-heads and members. Every invite link carries a department, a level and who sent it. **You can only invite people below you.** The admin sees a live "Who joined" tree: who, at which level, invited by whom, and when.
- **Tasks and expenses with real approvals.** The approver depends on the amount: up to ₹5,000 the sub-head, up to ₹25,000 the department head, above that the Finance head. The limits are live config in Flagsmith. Nobody can approve their own expense.
- **Notifications go only to the one person who must act** — your immediate head — not the whole family.
- **Speak instead of type** _(Layer 2, in progress)_: tap the mic and say _"Mamu paid 12,000 to the tent-wala"_ in Odia, Hindi or Bengali. Sarvam turns it into an expense routed to the right approver and replies aloud in the same language.

_The Mohanty family story used in the demo is illustrative._

## How each sponsor tool is used

### Sarvam AI — the voice of the app _(in progress)_
Speech-to-text (Saaras), tool-calling chat (`sarvam-105b`) that can only call the same permission-checked functions as the buttons, translation of tasks into each member's language, and spoken replies (Bulbul).
**Without it:** relatives who can't type English are left out — the people the app is for.

### Flagsmith — the family's rulebook
- `approval_limits` — the ₹ limits for sub-heads and heads. Read **only on the server** (Supabase Edge Function with the server key), so no one can raise their own limit from the app. Change it in Flagsmith and the very next expense routes differently. Each expense stores the limits it was routed with.
- `ai_voice` — the AI kill switch: off → the mic disappears and the app falls back to buttons.
- `sarvam_model` — which Sarvam model to use, swappable without a release.

**Without it:** limits are hard-coded, and turning AI off during an outage needs a new release.

### NudgeBee — operating the app _(in progress)_
An AI-outage runbook: a scheduled health check calls Wedora's `ai-health` function; if Sarvam is failing, NudgeBee asks the operator to approve, then flips `ai_voice` off in Flagsmith and records the event.
**Without it:** a Sarvam outage means a broken mic button in front of grandma at 11 pm the night before the wedding.

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

_Updated as we go._

- [x] Expo app connected to Supabase (anonymous device sign-in)
- [x] Database: departments, invite-only membership, tasks, expenses with amount-based routing, notifications, RLS
- [ ] Screens: create wedding, invites + join, tasks, expenses, approvals, admin dashboard, "Who joined" tree
- [ ] Voice in Odia / Hindi / Bengali (Sarvam)
- [ ] NudgeBee AI-outage runbook

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

_Real timings from the demo device will go here._

## AI tools used (disclosure)

This project was built during the hackathon by [yubaraj2000](https://github.com/yubaraj2000) with AI assistance, as allowed by the rules:

- **Claude Code** — wrote most of the code and SQL with me, set up the Supabase project and Flagsmith flags, and ran the builds. I reviewed and can explain every part.
- **Google Flow (Nano Banana 2.1)** — generated the Pattachitra-style illustrations and app icon.
- **Figma (via Claude Code)** — UI screen template.

Before the event I only did research, sponsor account setup and the requirements notes; all code and design were made after hacking started at 11:30.

## License

MIT — see [LICENSE](LICENSE).
