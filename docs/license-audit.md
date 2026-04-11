# AGPL v3 License Audit for GCIO Cal Rebrand

**Status:** Research-only (unit D2)
**Base branch:** `gcio-customizations`
**Scope:** Identify which "Cal.com" references in the fork MUST remain (AGPL-mandated) versus which CAN be rebranded safely.

---

## Executive Summary

- This repo is a dual-license fork. The root `LICENSE` is AGPL v3 with a Cal.com copyright line on top; 9 sibling `LICENSE` files under `apps/**/ee/`, `apps/api/v1/`, `packages/features/ee/`, `packages/embeds/embed-{core,react,snippet}/`, and `packages/app-store/{stripepayment,hitpay}/` apply the Cal.com Commercial (EE) License to those subtrees. The EE subtrees are stricter than AGPL and out of scope for a cosmetic rebrand.
- The AGPL obligations that matter here are **§5 (Conveying Modified Source Versions)**, **§5d (Appropriate Legal Notices)**, and **§13 (Remote Network Interaction)** — `LICENSE` lines 205-240 and 549-568.
- Cal.com does **not** ship per-file `Copyright (c) Cal.com` headers across `apps/web/` or `packages/`. Every `Copyright … Cal.com` match in the repo lives inside a `LICENSE` file, so the rebrand surface (`APP_NAME`, logos, marketing copy, nav labels, translation strings) is legally safe to touch.
- The AGPL-driven MUST KEEP set is narrow: the root `LICENSE` text (including its `Copyright (c) 2020-present Cal.com, Inc.` line), plus the EE `LICENSE` files wherever EE code still ships. Two items MUST be ADDED that don't exist today: a §5a modification notice and a §13 "Source" link.
- "Powered by Cal.com" is a **GREY ZONE**: a Cal.com product-branding feature gated by paid plans, not an AGPL §7 term. The string itself is safe to remove, but the underlying `hideBranding` column and service logic should stay put (they interlock with EE pricing).

---

## AGPL v3 Sections That Govern This Work

Verbatim from `/Users/yahvingali/global_cio/website/gcio-calcom/LICENSE`:

**§5 Conveying Modified Source Versions (LICENSE:205-230):**

> a) The work must carry prominent notices stating that you modified it, and giving a relevant date.
> b) The work must carry prominent notices stating that it is released under this License …
> c) You must license the entire work, as a whole, under this License to anyone who comes into possession of a copy.
> d) If the work has interactive user interfaces, each must display Appropriate Legal Notices; however, if the Program has interactive interfaces that do not display Appropriate Legal Notices, your work need not make them do so.

**§13 Remote Network Interaction (LICENSE:549-560):**

> Notwithstanding any other provision of this License, if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network (if your version supports such interaction) an opportunity to receive the Corresponding Source of your version by providing access to the Corresponding Source from a network server at no charge …

The **§5d carve-out** is load-bearing: upstream Cal.com does not render a copyright banner in its booking/dashboard UI, so the fork inherits that carve-out and is **not** required to add an "© Cal.com" footer.

---

## A. License Headers in Source Files

`grep -rn 'Copyright.*Cal\.com' apps/web packages` returns **only LICENSE files**. Zero `.ts`/`.tsx` source files carry a Cal.com copyright banner. The only non-LICENSE `AGPL` match in `apps/web/` is `apps/web/modules/auth/setup-view.tsx` (the `hasPickedAGPLv3` state variable), which is UI logic.

**MUST KEEP** (AGPL §5b, §5d — "keep intact all notices"):

- `/Users/yahvingali/global_cio/website/gcio-calcom/LICENSE` (line 1 copyright; lines 10-670 AGPL text)

**MUST KEEP** (Cal.com Commercial / EE license — separate contract, not AGPL):

- `/Users/yahvingali/global_cio/website/gcio-calcom/apps/web/modules/ee/LICENSE`
- `/Users/yahvingali/global_cio/website/gcio-calcom/apps/api/v1/LICENSE`
- `/Users/yahvingali/global_cio/website/gcio-calcom/apps/api/v2/src/ee/LICENSE`
- `/Users/yahvingali/global_cio/website/gcio-calcom/packages/features/ee/LICENSE`
- `/Users/yahvingali/global_cio/website/gcio-calcom/packages/embeds/embed-core/LICENSE`
- `/Users/yahvingali/global_cio/website/gcio-calcom/packages/embeds/embed-react/LICENSE`
- `/Users/yahvingali/global_cio/website/gcio-calcom/packages/embeds/embed-snippet/LICENSE`
- `/Users/yahvingali/global_cio/website/gcio-calcom/packages/app-store/hitpay/LICENSE`
- `/Users/yahvingali/global_cio/website/gcio-calcom/packages/app-store/stripepayment/LICENSE`

There is no "strip the copyright header from every .ts file" task for rebranders — those headers do not exist.

## B. Root LICENSE File — §5a Gap

`/Users/yahvingali/global_cio/website/gcio-calcom/LICENSE` is 670 lines: line 1 is the Cal.com copyright, lines 3-9 are the dual-license preamble, and lines 10-670 are the verbatim AGPL v3 text.

- **MUST KEEP** lines 1 and 10-670 exactly as-is (§5b, §5d).
- **MUST ADD** (AGPL §5a): a prominent `Modified by Global CIO Circle, Inc. beginning 2026-04-04` line either at the top of `LICENSE` or in the top-level `README.md`. This is missing on `gcio-customizations` today. Track as a follow-up unit — D2 is research only.

## C. First-Run Setup Wizard — License Picker

- `/Users/yahvingali/global_cio/website/gcio-calcom/apps/web/modules/auth/setup-view.tsx` lines 26, 33, 70-98, 86 (`hasPickedAGPLv3` state + the license-selection wizard step) — **CAN MODIFY**. This is a product gate, not a legal notice.
- `/Users/yahvingali/global_cio/website/gcio-calcom/apps/web/components/setup/LicenseSelection.tsx` lines 125-154 (AGPL-branded radio card, "Forever open & free" copy, `href="https://go.cal.com/self-hosted"` upsell link) — **CAN MODIFY**.
- `/Users/yahvingali/global_cio/website/gcio-calcom/packages/i18n/locales/en/common.json` keys: `choose_license_description` (line 2464), `agplv3_license` (2466), `agplv3_license_description` (4136), `choose_a_license` (2463) — **CAN MODIFY** (they are product copy).

**Caveat:** the picker must remain truthful. The underlying code is still AGPL, so a downstream self-hoster needs to know to satisfy their own §13 obligations. Rewording "Cal.com comes with…" to "GCIO Cal is based on Cal.com and distributed under AGPL v3. [Source]" is the minimum honest rewrite.

## D. "Source Code" Footer Link — §13 Gap

`grep -rn 'Source.?[Cc]ode' apps/web packages/features` returns only unrelated test/util matches. **Upstream Cal.com does not ship a "Source" footer link in the booking UI.** For a rebranded fork this is a compliance gap: a user of `cal.globalciocircle.com` has no visible way to learn the software is AGPL or where to get the source, which is exactly what §13 requires.

- **GREY ZONE → SHOULD ADD**: a small "Source" link in the booking/dashboard footer pointing to `https://github.com/Ygali04/gcio-calcom/tree/gcio-customizations`. This is the single most important net-new addition any rebrand unit should make.

## E. Copyright Notices in UI

`grep -rin '© Cal.com|© 2020' apps/web packages` matches only LICENSE and README.md — no UI component renders a "© Cal.com" footer. This confirms the **§5d carve-out applies** and no UI-level copyright banner is required.

## F. Branding Constants and Logos

`/Users/yahvingali/global_cio/website/gcio-calcom/packages/lib/constants.ts`:

| Line | Symbol | Current value | Category |
| --- | --- | --- | --- |
| 37 | `WEBSITE_URL` | `"https://cal.com"` fallback | CAN MODIFY |
| 38 | `APP_NAME` | `"Global CIO Circle"` | CAN MODIFY (done) |
| 39 | `SUPPORT_MAIL_ADDRESS` | `"support@globalciocircle.com"` | CAN MODIFY (done) |
| 40 | `COMPANY_NAME` | `"Global CIO Circle Inc."` | CAN MODIFY (done) |
| 41 | `SENDER_ID` | `"Cal"` | CAN MODIFY (not yet) |
| 42 | `SENDER_NAME` | `"Cal.com"` | CAN MODIFY (not yet) |
| 100-102 | `LOGO`, `LOGO_DARK`, `LOGO_ICON` | `/gcio-logo-*.png` | CAN MODIFY (done) |

None of these are AGPL-required.

## G. "Powered by Cal.com" / hideBranding

`/Users/yahvingali/global_cio/website/gcio-calcom/packages/features/profile/lib/hideBranding.ts` and the `removes_cal_branding` (common.json:1947) / `team_disable_cal_branding_description` (common.json:2099) translation keys implement a paid-plan upsell. The string is **CAN MODIFY**, but the `hideBranding` Prisma column and the resolver logic are a **GREY ZONE** — they are entangled with EE billing and should not be removed during a cosmetic rebrand.

---

## Decision Matrix

| Asset | Category | Rationale |
| --- | --- | --- |
| `LICENSE` lines 1, 10-670 | **MUST KEEP** | §5b / §5d — keep intact all notices |
| §5a "modified by" notice in `LICENSE` or `README.md` | **MUST ADD** | §5a — "prominent notices stating that you modified it, and giving a relevant date" |
| "Source" link in booking/dashboard footer | **SHOULD ADD** | §13 — remote network interaction disclosure |
| 9 EE `LICENSE` files | **MUST KEEP** | Cal.com Commercial License (not AGPL) |
| `packages/lib/constants.ts` branding (lines 37-42, 100-102) | **CAN MODIFY** | No per-file headers; not legal notices |
| `setup-view.tsx` + `LicenseSelection.tsx` wizard UI | **CAN MODIFY** (keep truthful) | Product gate, not legal notice |
| `agplv3_license*`, `choose_license_description` strings | **CAN MODIFY** (reword, don't lie) | Product copy; stay honest about underlying AGPL |
| "Powered by Cal.com" strings | **CAN MODIFY** | Product branding, not §7 term |
| `hideBranding` Prisma column + service | **GREY ZONE — do not touch** | Entangled with EE billing |
| `href="https://go.cal.com/self-hosted"` (LicenseSelection.tsx:148) | **CAN MODIFY** | Commercial upsell link |
| Per-file `.ts`/`.tsx` copyright banners | **N/A** | None exist |

---

## Conflicts / Corrections for C1-C8

1. **C1-C7 (string/logo rebrand) are safe.** No per-file copyright headers exist to preserve, the UI displays no copyright banner, and LICENSE files are outside the UI rebrand scope. The assumption behind C1-C7 is correct.
2. **C8 ("Powered by" removal) is safe as a string change**, but it must NOT delete the `hideBranding` Prisma column or `getBranding`/`hideBranding` service code — those bind to paid-plan gating and risk breaking EE billing.
3. **Missing work — recommend a new unit (C9 or D3):** (a) add an AGPL §5a modification notice to `LICENSE` or `README.md`, and (b) add a "Source" link in the booking/dashboard footer to satisfy §13. Neither exists today and the rebrand widens the gap.
4. **Do not touch any file under the EE subtrees** listed in section A during a cosmetic rebrand. Those are governed by the Cal.com Commercial License, a contract with Cal.com, Inc. — rebranding strings inside EE code is a sales conversation, not an AGPL one.
5. **Keep the setup wizard license picker truthful** (see section C). This composes with recommendation 3's Source link.
