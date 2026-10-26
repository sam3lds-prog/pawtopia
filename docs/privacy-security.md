# Pawtopia — Privacy & security

## Today (this build)

- **No account, no sign-in, no network calls.** The game is fully offline. Progress lives in WebView local storage
  under `pawtopia.*` keys (v1's `cvd.*` keys are kept as a backup).
- **No analytics leave the device.** `services/analytics.ts` keeps a 200-event in-memory ring buffer and has no sink
  registered. Event properties are game facts only; keys that look like identifiers are dropped even if passed.
- **No ads, no purchases in release builds.** `UnavailableAdService` / `UnavailableIapService` are the release
  defaults. Dev stubs exist only in development builds and their grants (`source: 'dev'`) are ignored in release.
- **Rendering safety.** All dynamic text goes through `esc()` before `innerHTML`; there is no user-generated text
  today (no display names).
- **Reset** removes only app-owned keys and keeps purchase entitlements; unrelated origin data is never touched.

## App Store privacy label (as built)

Data not collected. Revisit when any SDK (ads, purchases, analytics, crash reporting, backend) is added: each one
changes the label.

## When online features arrive (Phase 6+)

- Anonymous auth first; optional Sign in with Apple linking. **In-app account deletion** is required by Apple once
  accounts exist (`requestAccountDeletion`), deleting profile, standings visibility and attempts per retention policy.
- Display names: profanity filter + report flow; escaped everywhere; players can hide their rank.
- The client is untrusted. Ranked attempts are server-issued, replay-verified (`competitions/verify.ts`), timed by the
  server clock, rate-limited, App Check-protected; Firestore rules make score writes server-only. See
  `docs/backend-plan.md`.
- No raw device fingerprinting; no PII in analytics; aggregate where possible.
- Audience: general (not Kids Category). Kids Category would require removing third-party ads/analytics and a
  separate compliance review.
- Secrets: no service-account keys in the repo; Firebase web config is not a secret but App Check must be enforced.
