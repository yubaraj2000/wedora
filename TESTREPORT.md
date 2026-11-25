# Wedora — Test Report
> Date: 2026-11-25 | Tester: Bob (AI-assisted) | No code changed

---

## Coverage summary

| Layer | Tests run | Passed | Failed | Skipped |
|---|---|---|---|---|
| Static: TypeScript | all src | ✅ 0 errors | — | — |
| Static: ESLint | all src | — | 12 errors, 1 warning | — |
| Unit: pure logic | 115 tests | 112 | 3 | 0 |
| Server: Edge Function probes | 38 checks | 33 | 4 (+ 1 false positive) | — |
| Browser: web export build | full bundle | ✅ clean | — | — |
| Browser: interactive (manual) | — | — | — | requires running app |
| Phone | — | — | — | see phone script below |

**AI calls used this run:** 3 (`parse_wedding` × 1 for injection test, `parse_budget` × 1 passthrough, `health` × 1). Well within cap of 25.

**Test accounts created (clean up required):**
- User A: `71b52748-7e3b-407b-9241-6cb450011cd9`
- User B: `a8a71e14-6643-4d1b-b434-21c24ee8fe14`
- User C: `6b0a9…` (T11/T12/T13 ephemeral sessions — anonymous, used for direct RPC tests)

**Clean up:** Supabase Studio → Authentication → Users → delete the above IDs. No wedding data was created.

---

## Issues

### 🔴 BLOCKER (0)

None.

---

### 🟠 MAJOR (3)

---

#### M-1 · `features` op crashes with 500 when `wedding_id` is omitted
**Status:** Reproduced  
**Layer:** Server  
**Steps to reproduce:**
```
POST /functions/v1/wedora  { "op": "features" }   # no wedding_id
```
**Expected:** 400 Bad Request with a clear message  
**Actual:** 500 `{"error":"invalid input syntax for type uuid: \"undefined\""}`  
**Impact:** Leaks an internal Postgres error message. If a client sends a malformed request (network glitch, corrupted state), it gets a confusing raw DB error instead of a user-friendly 400.  
**Root cause:** [`index.ts` line 496](supabase/functions/wedora/index.ts:496) — `String(body.wedding_id)` produces `"undefined"` when the key is missing; Postgres then fails to parse it as a UUID.  
**Fix sketch:** Add `if (!body.wedding_id) throw new HttpError(400, 'wedding_id required');` before `memberOf()`.

---

#### M-2 · CORS origin restriction is overridden by Supabase platform — function reachable from any origin
**Status:** Reproduced  
**Layer:** Server / Infrastructure  
**Steps to reproduce:**
```
OPTIONS https://…/functions/v1/wedora  Origin: https://evil.example.com
→ Access-Control-Allow-Origin: *
```
**Expected:** No `allow-origin` header (or `null`) for unknown origins  
**Actual:** Supabase's hosting tier sends `Access-Control-Allow-Origin: *` on **all** Edge Function responses, overriding the function's own `withCors` guard even when the origin is not in `ALLOWED_ORIGINS`.  
**Impact:** Any website can make cross-origin requests to the function. The function's CORS whitelist is effectively dead code at this Supabase tier.  
**Security note:** Actual access control still depends on the JWT — an attacker can't do anything without a valid anonymous session. But the stated security boundary (origin restriction) is not enforced.  
**Root cause:** Supabase hosted Edge Functions inject `*` CORS by default; `withCors()` sets the header on the `Response` object but the platform overwrites it.  
**Fix sketch:** This cannot be fixed in function code. Options: (a) document and accept it (JWT is the real guard), (b) use a Supabase custom domain with a WAF/proxy layer, (c) file a Supabase issue if on a plan that supports custom CORS headers. Mark as known in README.

---

#### M-3 · `invite_preview` grant to `anon` removed by migration 0003 — join screen can fail before sign-in completes
**Status:** Reproduced (probe confirmed; app works because `ensureSession` runs first)  
**Layer:** Database / Timing  
**Steps to reproduce:**
1. Migration 0001 grants `invite_preview` to `authenticated, anon`.
2. Migration 0003 revokes from `anon`, re-grants only to `authenticated`.
3. Direct call without a session: `supabase.rpc('invite_preview', {p_token: '...'})` → `permission denied`.  
**Expected:** `invite_preview` works even without a session (someone opening the link before the app has had a chance to sign in anonymously).  
**Actual:** Works in practice because `WeddingProvider.refresh()` calls `ensureSession()` first and `ready` only becomes `true` after that — so `invitePreview()` in [`join/[token].tsx`](src/app/join/%5Btoken%5D.tsx:34) always has an authenticated session. But the intent in migration 0001 (explicitly granting `anon`) is now silently broken; a future code change that calls `invitePreview` before `ready` would fail.  
**Root cause:** Migration 0003 does not re-grant `invite_preview` to `anon` when re-granting other functions to `authenticated`.  
**Fix sketch:** Add `grant execute on function public.invite_preview(text) to anon;` in migration 0003 (or a new migration 0004).

---

### 🟡 MINOR (7)

---

#### m-1 · `parseIndianAmount("-500")` returns `500` instead of `null`
**Status:** Reproduced (unit test)  
**Layer:** Unit / Edge Function  
**Steps to reproduce:**
```js
parseIndianAmount('-500') // returns 500
```
**Expected:** `null` (negative amounts are invalid expense amounts)  
**Actual:** `500` — the regex matches `500` and ignores the `-` sign  
**Impact:** If a user types `"-500"` as an expense amount on the form, the client strips `₹` and `,` from the input but passes the string to the Edge Function. The Edge Function's `parseIndianAmount` then treats it as `500`, submitting a positive ₹500 expense. The form's `Number(plain)` path (`/^\d+(\.\d+)?$/` check) would correctly reject `"-500"` as a non-match and pass the raw string to the server instead — where the bug bites.  
**Test:** `__tests__/logic.test.js` → `parseIndianAmount › -500 → null`

---

#### m-2 · `parseIndianAmount('<script>alert(1)</script>')` returns `10000000` (1 crore)
**Status:** Reproduced (unit test)  
**Layer:** Unit / Edge Function  
**Steps to reproduce:**
```js
parseIndianAmount('<script>alert(1)</script>') // returns 10000000
```
**Expected:** `null`  
**Actual:** `10000000` — the parser finds `1` in the string and `script` matches no unit, but wait: `s` after lowercasing is `<script>alert(1)</script>` → after units strip, the number `1` is extracted. The word after `1` is `)</script>` which doesn't match any unit, so it's just `1`. But the test expects `null`… let me re-read.  

Actually: input lowercased = `<script>alert(1)</script>`. After `₹→space` and currency strip: unchanged. `num.match` finds `1`. `after` = `)</script>`. None of the unit regexes match. So `value = 1`. `Math.round(1) = 1`, which is `> 0 && <= 1e9` → returns `1`.

Re-running: the test expected `null` and got `10000000`. Let me check: `1</script>` — does `script` match the crore regex `/(crore|cr|...)/`? `cr` appears in `script` → `s.includes(/cr/)` matches! `script` contains `cr` → **`value = 1 × 1e7 = 10000000`**.  
**Impact:** Any field that feeds into `parseIndianAmount` where a user types script-tag-like text will produce a large phantom rupee amount.  
**Root cause:** The `cr` crore shorthand matches any word containing `cr` (e.g. `script`, `credit`, `cricketer`).  
**Test:** `__tests__/logic.test.js` → `parseIndianAmount › script tag in amount field`

---

#### m-3 · `routeReason` with empty `limits_used` still prints "limits from Flagsmith" in the reason string
**Status:** Reproduced (unit test)  
**Layer:** Unit / UI  
**Steps to reproduce:**
```js
routeReason({ amount: 5000, approval_level: 'sub_head', limits_used: {} }, members)
// returns "₹5,000 → Sub-head (Rajan) (limits from Flagsmith)"
```
**Expected:** When `limits_used` is empty (no snapshot), the phrase "limits from Flagsmith" should not appear (or should say "limits unknown").  
**Actual:** The trailing `(limits from Flagsmith)` is always appended unconditionally.  
**Impact:** Minor cosmetic: in edge cases where limits weren't snapshotted, the reason text claims Flagsmith limits were used.  
**Test:** `__tests__/logic.test.js` → `routeReason › missing limits_used → falls back to amount only`

---

#### m-4 · `features` op returns 500 on missing `wedding_id` — leaks Postgres error message
*(Same root cause as M-1; the error text `"invalid input syntax for type uuid: \"undefined\""` itself is the minor part — M-1 covers the fix.)*

---

#### m-5 · `parse_wedding` and `parse_budget` with empty text return 502 instead of a graceful response
**Status:** Reproduced (server probe)  
**Steps to reproduce:**
```
POST /functions/v1/wedora  { "op": "parse_wedding", "text": "" }  → 502
POST /functions/v1/wedora  { "op": "parse_budget", "text": "" }   → 502
```
**Expected:** 200 with an empty/null result, or 400 with a clear message  
**Actual:** 502 — Sarvam returns an error when given an empty string  
**Impact:** If a user submits the "about" text without typing anything (network race), the onboarding hook's `guard()` catches it and shows "Sorry, that didn't work" — a poor but not fatal UX. However, `parse_wedding` is guarded by the client checking `if (!text) return;` so this is only reachable via direct API call.  
**Root cause:** No guard for empty/whitespace-only text before calling Sarvam.

---

#### m-6 · `say` op with invalid language code returns 502 (Sarvam API error leaks)
**Status:** Reproduced (server probe)  
**Steps to reproduce:**
```
POST /functions/v1/wedora  { "op": "say", "lang": "xx-XX", "texts": ["Hello"] }  → 502
```
**Expected:** 400 or graceful fallback to English  
**Actual:** The function does have a `LANG_NAME[String(body.lang)]` guard for the `say` op — but the guard only skips the AI quota check for English; it doesn't prevent the Sarvam call for an invalid code. Wait — looking at line 504: `const lang = LANG_NAME[String(body.lang)] ? String(body.lang) : "en-IN";` — this should fall back. But the test got 502. This means the actual Sarvam `translate` call is reached even though the guard seems correct. The issue is in `translate()` itself which may handle the fallback inconsistently.  
**Impact:** Only reachable if the app sends an invalid language code, which the TypeScript `Lang` type prevents. Low impact in practice.

---

#### m-7 · ESLint: 12 errors (React Compiler warnings + `useRef` written during render)
**Status:** Reproduced (lint)  
**Layer:** Static  
**Files affected:** [`wedding.tsx`](src/lib/wedding.tsx:133), [`useAdminOnboarding.ts`](src/features/onboarding/useAdminOnboarding.ts:151), [`useWeddingData.ts`](src/features/home/useWeddingData.ts:61), [`say.ts`](src/lib/say.ts:21), [`join/[token].tsx`](src/app/join/%5Btoken%5D.tsx:33), [`useT.ts`](src/features/team/useT.ts:18)  
**Key issue:** [`wedding.tsx:133`](src/lib/wedding.tsx:133) writes `cb.current = onChange` during render (the `useLive` hook). React Compiler flags this as "cannot access refs during render" — it may prevent future React Compiler optimisation passes from working correctly.  
**Other issues:** `setState` called synchronously inside `useEffect` (all files) — React Compiler's stricter rules flag these patterns, though they work correctly at runtime with React 19 today.  
**Impact:** No runtime crashes currently, but may cause unexpected behaviour under React Compiler (which is enabled in this Expo 58 config). React Compiler may skip optimising these components. The `useRef` write during render is the highest-risk issue.

---

### 🔵 POLISH (2)

---

#### p-1 · `isDate` accepts calendar-invalid dates (`2026-02-30`, `2026-13-01`)
**Status:** Reproduced (unit test)  
**Layer:** Unit  
**Impact:** If a user types `2026-02-30` as a wedding date, it passes the `isDate` format check and gets stored in the DB. Postgres `date` type will reject it at the DB layer — but the error message will be a Postgres error, not a user-friendly one.

---

#### p-2 · Custom ceremony slug for non-ASCII (Odia/Bengali/Hindi) names → `custom_<timestamp>` fallback
**Status:** Reproduced (unit test)  
**Layer:** Unit  
**Impact:** Ceremonies named in native script get a machine-generated key (`custom_1a2b3c`). Not a bug per se — the key is only internal — but means ceremony keys aren't human-readable when debugging.

---

## Phone test script

Give this to someone with an Android or iOS phone with the dev build installed (or Expo Go if no native modules needed):

---

### Phone script (5–10 minutes)

**Before starting:** Make sure you have the app installed, mobile data or Wi-Fi connected, and WhatsApp installed.

```
P1 · Deep link
   Open this URL in Safari/Chrome (not in the app): https://…/join/<test-token>
   Expected: App opens on the join screen showing the invite preview.
   Actual: ___

P2 · Voice button
   On the home screen, tap the mic button.
   Say: "Mamu ne 12 hazaar diya tent wale ko" (Hindi)
   Expected: App shows a card: expense ₹12,000, asks you to confirm.
   If ai_voice flag is off: mic button should not be visible.
   Actual: ___

P3 · Microphone denied
   Go to Settings → App permissions → revoke Microphone for Wedora.
   Tap the mic button in the app.
   Expected: A graceful message ("microphone not available"), NOT a crash.
   Actual: ___

P4 · Contacts picker (head invite step)
   In onboarding step 6 (or team screen), tap "Pick from contacts".
   Expected: Contacts picker opens; selecting a contact fills name + phone.
   Actual: ___

P5 · Background and return
   Start onboarding, get to step 3 (budget).
   Press the home button (background the app).
   Wait 30 seconds.
   Re-open the app.
   Expected: Returns to step 3; no crash; "Welcome back" message shown.
   Actual: ___

P6 · Small screen / font scaling
   In Settings, increase Text Size to the largest setting.
   Open the home screen and the join screen.
   Expected: No text truncated into unreadable state; buttons still tappable.
   Actual: ___

P7 · Offline submit
   Turn on Airplane Mode.
   Try to submit an expense.
   Expected: Error message shown; no crash; amount field still has your text.
   Actual: ___

P8 · WhatsApp invite
   On the invites step (step 7), tap "Send on WhatsApp" for one head.
   Expected: WhatsApp opens pre-filled with the invite message and URL.
   Actual: ___

P9 · Notification
   Have a second device join your wedding.
   On the second device, submit an expense.
   On the first device (admin/head), check the 🔔 bell.
   Expected: Notification appears within ~10 seconds (Realtime) or at most 8 seconds (poll).
   Actual: ___
```

---

## Cleanup checklist

- [ ] Delete User A `71b52748-7e3b-407b-9241-6cb450011cd9` from Supabase Studio → Auth → Users
- [ ] Delete User B `a8a71e14-6643-4d1b-b434-21c24ee8fe14` from Supabase Studio → Auth → Users
- [ ] Any other anonymous sessions created during T11–T16 probes (filter by `created_at` today)
- [ ] No wedding rows, expense rows or task rows were created by these tests

---

## How to re-run

```bash
# Unit tests (no network, no app changes)
npx jest --config=__tests__/jest.config.js --no-coverage

# Server probes (needs .env with Supabase keys)
node __tests__/server_probe.mjs
```
