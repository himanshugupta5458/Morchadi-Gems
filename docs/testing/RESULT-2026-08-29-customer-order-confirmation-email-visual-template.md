# Test Result: Customer order-confirmation email — branded visual template — 2026-08-29

- **Plan:** [PLAN-customer-order-confirmation-email.md](PLAN-customer-order-confirmation-email.md), "Cases added for the branded visual template (prompt 106)"
- **Commit:** the working tree of prompt 106, on top of `69e8d73`
- **Environment:** local. Node, no live Postgres required for these cases (`lib/order-capture.ts`'s
  new `createdAt` field is exercised by the existing skip-with-no-database suites, unchanged in
  this run's environment). `RESEND_API_KEY` still not present in `.env.local`; no automated case
  and no manual trace reached the real Resend API.

| ID | Result | Notes |
| --- | --- | --- |
| TC-32 | Pass | `extractJourneyStepFills` in `lib/customer-email-message.test.ts` pulls `data-step="…" bgcolor="…"` pairs from between the `<!-- journey-start -->`/`<!-- journey-end -->` markers so the assertion cannot be confused by the header band or the tracking button, which reuse the same gold and ink colours elsewhere in the email. Checked for the COD email, a fully-paid email, a partial-payment email and the no-bundle degraded email — all four |
| TC-33 | Pass | `formatTrackingDate` (already used by `/track`) reused rather than a new formatter; `createdAt: null` omits the "Placed on" row entirely rather than rendering a blank value |
| TC-34 | Pass | Updated from the plain-shell assertion (`Track your order: {url}`) to `href="{url}"` plus the visible label, since the button is now a table cell rather than a `<p><a>` sentence — the underlying behaviour (prominent when present, wholly absent when not) is unchanged and still asserted |
| TC-35 | Skipped | No reachable Postgres in this run. `lib/order-capture.test.ts` and its siblings print their standard "no database" skip reason and exit 0, per this suite's existing convention |
| TC-36 | Pass | All 15 pre-existing content/honesty cases in `lib/customer-email-message.test.ts` pass unmodified in substance against the new markup, plus the 14 in `lib/notify-customer-email.test.ts` |
| TC-37 | Pass | See Gate below |
| TC-38 | Pass | See "Rendered output" below |

## Design tokens — read from the codebase, not invented

| Token | Value | Source |
| --- | --- | --- |
| Ink / primary text | `#1C1C1C` | `tailwind.config.ts` `colors.ink` / `colors.charcoal` |
| Gold / accent | `#C6A24C` | `tailwind.config.ts` `colors.gold` — used for the header's top band and the journey graphic's one filled step |
| Ivory / page ground | `#FDFBF7` | `tailwind.config.ts` `colors.ivory` — the payment box's shaded background |
| White / card surface | `#FFFFFF` | `tailwind.config.ts` `colors.white` |
| Muted text | `#6B6B6B` | `tailwind.config.ts` `colors.muted` |
| Hairline / disabled fill | `#E8E4DC` | `tailwind.config.ts` `colors.line` — the three un-filled journey circles and their connecting lines |
| Heading font | Fraunces, falling back to `Georgia, 'Times New Roman', serif` | `app/layout.tsx`'s `Fraunces({ variable: "--font-display" })`; `tailwind.config.ts`'s own `fontFamily.display` fallback stack, restated literally since an email client cannot load `--font-display` |
| Body font | Jost, falling back to a system sans stack | `app/layout.tsx`'s `Jost({ variable: "--font-sans" })`; `tailwind.config.ts`'s `fontFamily.sans` |
| Button corner radius | `2px` | `tailwind.config.ts` `borderRadius.card` (`0.125rem`), applied to the tracking button and the payment box |
| Logo | `public/logo.png`, via `absoluteUrl("/logo.png")` | Same asset `lib/structured-data.ts` already points the Organization schema's `logo` at |

No new palette or font pairing was introduced. The primary button styling (dark ink fill, ivory
text) mirrors `components/Button.tsx`'s `primary` variant; the journey graphic's filled/muted
circle pattern mirrors `components/CheckoutSteps.tsx`'s current/complete-vs-upcoming treatment,
adapted to table markup.

## What did not change

Every subject line, every honesty rule (COD states nothing paid; a partial order states the
balance due; cost/margin data reaches neither composer's input type in the first place — see the
"Cost/margin seal" section of the prior result), and both trigger points are untouched. TC-01
through TC-30 from the original plan pass without their assertions being weakened — several were
adapted to the new tag shape (noted in TC-34), never to check less than before.

## Rendered output — all three order types

`RESEND_API_KEY` is still absent from `.env.local` in this environment and there is no outbound
internet access, so a real Resend send could not be attempted, exactly as in the prior result. A
temporary test (`lib/__manual-trace.test.ts`, deleted after the run — not part of the shipped
diff) called the real `composeCodOrderConfirmationEmail` and `composePaidOrderConfirmationEmail`
directly with representative order data and wrote each returned HTML string to a file, so the
actual rendered markup — not a description of it — could be opened in a browser before this was
considered done.

**Preview:** all three emails are viewable in one page, each in a 600px/375px device frame with
a subject line and a live width toggle, at
https://claude.ai/code/artifact/63e2fee2-fb71-41f7-9aca-a52093875269

The logo resolves to `http://localhost:3000/logo.png` in every rendering, because no
`APP_BASE_URL` is set in this environment; in the artifact preview this shows as a broken image
with the `alt` text ("Morchadi Gems") standing in for it — a reasonably honest stand-in for what
an image-blocking inbox shows, and confirmation that nothing else on the page depends on the
image loading. In production `absoluteUrl()` resolves to the real domain.

Subjects confirmed unchanged: `Your Morchadi Gems cash-on-delivery order is placed`,
`Your Morchadi Gems order is confirmed`, `Your Morchadi Gems order is confirmed: balance due at
delivery`.

## Gate

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass, no output |
| `npm run lint` | `✔ No ESLint warnings or errors` |
| `npm run test:run` | **94 files, 1908 passed, 0 failed, 0 skipped** |
| `npm run validate:products` | `PASS — all checks green` (unchanged advisories only) |
| `npm run build` | Pass, 475 pages |

The suite was 1904 passing before this change and is 1908 after: 4 new cases in
`lib/customer-email-message.test.ts` (the journey-graphic structural test and the order-placed
timestamp test, for each of the COD and paid/partial composers) — no other file gained a case,
since `lib/notify-customer-email.test.ts`'s existing cases only needed a `createdAt` field added
to their already-passing fixtures (1904 + 4 = 1908).
