---
name: morchadi-product-meta
description: Generate SEO metadata for Morchadi Gems products (meta title, meta description, image alt text, OpenGraph title/description/image, and an internal keyword target set). Use when adding a new product or optimizing product-page metadata. Produces honest, click-worthy, character-verified metadata for the Indian market. Runs after the product description exists.
---

# Morchadi Gems Product Meta / SEO Skill (v2)

## Purpose
Generate search-and-social metadata for a Morchadi Gems product: meta title, meta description, image alt text, OpenGraph (title, description, image), and an internal keyword target set. Output must be honest (same rules as the description skill), correctly sized for how Google and WhatsApp/social actually render, written for the Indian market (British spelling, Indian-English jewellery terms), and genuinely click-worthy rather than keyword-stuffed. This skill runs AFTER the description is written; use the description and specs as source truth. All character counts must be MEASURED, never estimated.

## Brand context
- Affordable Indian anti-tarnish fashion jewellery, roughly ₹49 to ₹499, INR, guest checkout, ships across India.
- Positioning: "everyday sparkle, honestly priced." Accessible-elegant, not luxury, not hype.
- Materials, named honestly: anti-tarnish, gold-plated, silver-plated, rhodium-plated, brass, cubic zirconia (CZ), crystal, glass, enamel, German silver (a silver-toned copper-nickel alloy, no silver). NEVER hallmarked, certified, karat-on-plated ("18K plated"), precious, sterling (unless the spec says so).
- Trust hooks: anti-tarnish/skin-friendly (only where specs/collections support it), 7-day returns, dispatch in 2 / delivery in 7 days, free shipping over ₹799 (see the sub-₹799 rule below), ships across India.
- Market: Indian shoppers, mostly mobile, searching British-English and Indian-English jewellery terms.

## Source of truth
Per product, read from data/products.json: name, category, the written description, specs, pricing.price, pricing.mrp, collections, options. Derive metadata only from these. If a product is NOT tagged anti-tarnish in collections, do not call it anti-tarnish. If a claim isn't supported by specs/description, it cannot appear.

## 1. Keyword target set (internal planning, NOT a page tag)
This informs the title, description, and alt. It is NOT output as a <meta keywords> tag (Google ignores that tag). (Note: keep this explanation in prose; do not let the parenthetical leak into the output block.)
- Pick ONE primary keyword: category + finish + defining feature, in the phrasing an Indian shopper types.
- **Prefer the Indian-English term the shopper actually types** (nath, jhumka, payal, kada, maang tikka, bangles, anklet) over the generic English gloss. Include the gloss as a secondary term where useful (e.g. primary "gold-plated nath", secondary "nose pin").
- Pick 2 to 4 honest secondary/long-tail terms this specific product genuinely satisfies (material, occasion, use-case).
- **Collision rule:** across the batch, no two products may share the same primaryKeyword or the same metaTitle. If variants converge (three CZ studs, several bow rings), differentiate by the distinguishing option (colour, motif, size) in both the keyword and the title.

## 2. Meta title
- Aim ~50 to 60 characters, but Google truncates by PIXEL WIDTH (~600px desktop), not character count. Wide capitals and the ₹ symbol consume more width, so treat 60 as generous, not exact. Mobile SERPs wrap titles to two lines and often show MORE characters than desktop, not fewer.
- Structure: PRIMARY KEYWORD / product name FIRST; searchable words at the front, never at truncation risk.
- Brand: append " | Morchadi Gems" only if it fits without pushing the product keywords toward truncation. Product keywords always win the character budget.
- Price may appear in the title ONLY when the price itself is the primary click reason, and only if the keyword still leads.
- No two products share a metaTitle (see collision rule).
- Honest: real materials only, colour-words not stone-names, "Gold-Plated" not "Gold." Title Case fine. No ALL CAPS, no "!!!", no "Buy Now."

## 3. Meta description
- Aim 140 to 160 characters (MEASURED). Hard ceiling ~165; never below 140 (wastes SERP space) unless honesty forces brevity. Google often rewrites meta descriptions, so it must also read well if truncated mid-way.
- Lead with the strongest CLICK REASON for THIS product, chosen per product, not a fixed rule: price (when the low price is the wow), anti-tarnish/durability (only if genuinely tagged), or the design (when the piece itself is the draw). Rotate the lead across the batch.
- Primary keyword early (it may bold in the SERP on a query match).
- Add ONE trust nudge where there's room. **Sub-₹799 rule:** on products under ₹799, prefer 7-day returns or dispatch-in-2; use the free-shipping-over-₹799 nudge only where a multi-item purchase is plausible (sets, bangles), since touting an ₹799 threshold on a single ₹109 item is misleading. Some descriptions should carry NO nudge at all (vary it).
- Write fresh: a meta description is NOT the first 155 chars of the on-page description (different job). Warm-but-plain voice. No banned adjectives, no em dashes. Complete thought, not mid-sentence.

## 4. Image alt text
- Accessibility first (screen readers), image SEO second. Describe what is actually IN the image.
- Content: material/finish, product type, defining visual feature, colour. Under ~125 chars / 8 to 16 words. Vary the OPENING across the batch (do not open every alt with the material word).
- Honest, concrete, no marketing adjectives, no keyword stuffing. Do NOT start with "image of"/"picture of".
- **One alt per image.** If a product has multiple images (gallery/variant), output one alt line per image, each describing THAT image, none identical.
- Alt text must NOT be a verbatim/near-verbatim clone of the meta description or og:description (see anti-clone rule).

## 5. OpenGraph (social sharing, WhatsApp-first)
WhatsApp is the primary share surface; get these right the FIRST time because WhatsApp caches link previews aggressively and a corrected card will not re-render for people who saw the old one.
- **og:image (mandatory):** without it, a shared link renders with NO card at all. Output the primary product image path from the product data, and note the 1200×630 / under ~300KB requirement as an implementation flag for the storefront (this skill outputs the metadata text; emitting the tags is the storefront's job, so do not claim to have confirmed page emission).
- **og:title:** ~40 to 70 chars, brand-friendly (social cards show brand well).
- **og:description:** WhatsApp shows only roughly the FIRST ~80 CHARACTERS, so the pitch must land in the first clause. Full text up to ~200 chars for platforms that show more. Warmer than the meta description, still honest, no AI tells.
- **og:type:** use "website" unless the page emits full product-namespace markup, in which case "product.item" with product:price:amount / product:price:currency tags (which can surface price on Facebook shares). WhatsApp largely ignores og:type, so this won't affect the WhatsApp card. **og:url** = the canonical product URL.
- All honest, British spelling, no em dashes.

## Honesty rules (same hard line as the description skill)
- Only real materials/claims, from specs/description. Vaguer-but-true beats specific-but-invented.
- NEVER: hallmarked, certified, karat-on-plated, precious, sterling (unless spec says so), "real/genuine" gold or silver, gemstone names for non-gemstones (use colour-words).
- Anti-tarnish/skin-friendly ONLY where collections/specs support it; never on German silver or bare brass for skin comfort.
- German silver: if named, make clear it is a silver-toned alloy, not silver.
- **Misleading source title:** if the product's NAME in the data names a stone/material that isn't real, the metadata uses the HONEST corrected name in every field, and appends `NAME FLAG: <reason>` to the output.
- **Price in metadata:** if a price appears in any field, append `PRICE-DATED: ₹X` to the output so stale prices can be audited when a sale ends.

## Anti-AI / anti-stuffing / batch rules
- No em dashes. No banned promotional adjectives (stunning, exquisite, gorgeous, must-have, elevate, timeless, versatile, statement, luxurious, dainty, charming, effortless, radiant) or morphological variants.
- No keyword stuffing: primary keyword at most once per field; never comma-list keywords as if the field were a tag.
- **No field-clones:** within a product, metaTitle, metaDescription, imageAlt, and ogDescription must each be INDEPENDENTLY phrased. No field repeats another verbatim or near-verbatim.
- **The batch tell is rhythm, not adjectives:** avoid 49 meta descriptions that are all "two sentences, descriptive then nudge." Vary sentence count, vary where/whether the nudge sits, and let some carry no nudge.
- **Ledger (mandatory bookkeeping):** after each product, record one line: product ID | primaryKeyword | metaTitle | meta-desc lead angle (price/design/durability/occasion) | alt-text opening word | trust nudge used (or none). Consult it before writing the next product. The collision check (no duplicate primaryKeyword or metaTitle) is performed against this ledger, NOT against memory. Do not reuse the same lead angle more than twice consecutively. Without this ledger, variation and uniqueness decay by product 15.

## Method (per product)
1. Read name, description, specs, price, mrp, collections, options.
2. Decide the primary keyword (Indian-English preferred) and 2 to 4 honest secondary terms. Check the collision rule against the LEDGER of products already done (not memory): the new primaryKeyword and metaTitle must not duplicate any recorded one.
3. Write the meta title: keyword/product first, brand only if it fits; price only if it's the primary click reason.
4. Choose the strongest click reason; write the meta description leading with it, keyword early, apply the sub-₹799 nudge rule, vary rhythm.
5. Write the image alt (one per image), varied opening, plain and accurate.
6. Write og:title, og:description (pitch in first ~80 chars), and confirm og:image/type/url.
7. **VERIFY every character count programmatically.** Measure all of a product's fields in a single script (use a heredoc, not a one-liner, so apostrophes and the ₹ symbol don't break on shell quoting), and reference its output. A count annotated "verified" without a corresponding measurement run is a rule violation. If code execution is unavailable in the environment, annotate counts as UNVERIFIED, never as verified. If a field is out of range, rewrite and re-verify. The count noted in output must be the MEASURED count.
8. Self-check: no em dashes, no banned adjectives, no field-clones, honesty rules pass, British spelling, varied from the previous product. Add NAME FLAG / PRICE-DATED where applicable. Update the ledger.

## Output format (per product)
```
P0XX
primaryKeyword: <one phrase>
secondaryKeywords: [<phrase>, <phrase>, ...]
metaTitle: <text>   (NN chars, verified)
metaDescription: <text>   (NNN chars, verified)
imageAlt: <text>   (one line per image)
ogTitle: <text>   (NN chars, verified)
ogDescription: <text>   (NNN chars, verified)
ogImage: <primary product image path>   1200x630 target
[NAME FLAG: <reason>]   (only if the source title is misleading)
[PRICE-DATED: ₹X]   (only if a price appears in any field)
Ledger: P0XX | kw: <primaryKeyword> | title: <metaTitle> | lead: <angle> | alt opens: <word> | nudge: <type or none>
```
Keep the "internal targeting, not a page tag" explanation in the skill prose, NOT inside the output block. Default to outputting for review; do not write to products.json unless told.

## Calibration example (all counts machine-verified)
Product: Silver-Tone Twisted Band Ring, CZ bow, rhodium-plated brass, adjustable, ₹199 (was ₹399). Category: rings. Not tagged anti-tarnish.

```
P0XX
primaryKeyword: silver-tone bow ring
secondaryKeywords: [adjustable ring for women, cubic zirconia ring, rhodium-plated ring, everyday ring]
metaTitle: Silver-Tone Bow Ring, Adjustable CZ Band | Morchadi Gems   (56 chars, verified)
metaDescription: A silver-tone bow ring on a twisted, rhodium-plated band, adjustable to fit most fingers. The cubic zirconia bow catches light at ₹199, with 7-day returns.   (155 chars, verified)
imageAlt: Rhodium-plated twisted band ring with a small cubic zirconia bow, silver-tone finish   (12 words)
ogTitle: Adjustable Bow Ring in Silver Tone, ₹199 | Morchadi Gems   (56 chars, verified)
ogDescription: A twisted silver-tone band topped with a little cubic zirconia bow, made to wear every day. Adjustable fit, ₹199 down from ₹399 at Morchadi Gems.   (145 chars, verified)
ogImage: /products/P0XX.webp   1200x630 target
PRICE-DATED: ₹199
Ledger: P0XX | kw: silver-tone bow ring | title: Silver-Tone Bow Ring, Adjustable CZ Band | Morchadi Gems | lead: design | alt opens: Rhodium-plated | nudge: 7-day returns
```
Why this works: keyword leads the title with brand fitting inside the budget; description leads with the design (the bow is the draw, price secondary), no anti-tarnish claim (not tagged), rhodium-plated named honestly and "silver-tone" never "silver"; the trust nudge is 7-day returns not the irrelevant ₹799 threshold (sub-₹799 rule); alt, meta description, and og:description are each phrased independently (no field-clones); og:image is present; price is flagged PRICE-DATED; all counts machine-verified. This is ONE valid shape, not THE shape: rotate the lead angle, the alt opening, and the nudge across the catalogue so 49 products do not read as one template.

Second example (PRICE-led, to show the rotation the batch rules require). Product: Gold-Plated Peacock Nath, ruby-red stones and pearl-look drop, screw-fit, ₹109 (was ₹249). Category: nose-pins. Not tagged anti-tarnish.

```
P032
primaryKeyword: gold-plated peacock nath
secondaryKeywords: [nath for wedding, screw nose pin, festive nath, nose pin with stones]
metaTitle: Gold-Plated Peacock Nath with Ruby-Red Stones   (45 chars, verified)
metaDescription: From ₹109, a gold-plated peacock nath with ruby-red stones and a pearl-look drop. Screw-fit nose pin that carries a festive look on its own.   (140 chars, verified)
imageAlt: Screw-fit peacock nath in gold-plated metal with ruby-red stones and a pearl-look drop
ogTitle: Gold-Plated Peacock Nath, ₹109 | Morchadi Gems   (46 chars, verified)
ogDescription: A detailed peacock nath with ruby-red stones and a pearl-look drop, made to carry a festive look on its own. Screw-fit, from ₹109 at Morchadi Gems.
ogImage: /products/P032.webp   1200x630 target
PRICE-DATED: ₹109
Ledger: P032 | kw: gold-plated peacock nath | title: Gold-Plated Peacock Nath with Ruby-Red Stones | lead: price | alt opens: Screw-fit | nudge: none
```
Note the rotation from the first example: this one LEADS with price (the ₹109 wow), opens the alt on "Screw-fit" (a fit fact, not the material), and carries NO trust nudge (the batch rules say some should not). Between the two examples: two different lead angles, two different alt openings, two different nudge choices. That is the variation the ledger enforces across all 49.