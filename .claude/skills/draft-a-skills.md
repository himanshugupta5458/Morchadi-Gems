# Draft A Extraction Skill

## Purpose

Convert raw product text — either a migrated listing's original copy, or
owner-provided facts about a fresh listing — into one structured Draft A
JSON object. This skill extracts and organises what the source text
says. It never invents facts, and it never writes anything identity- or
money-related directly into a published product without explicit owner
confirmation — every material, stone, treatment, and price value this
skill produces is a CANDIDATE for review, never a final answer.

## Core principle (changed from earlier drafts)

There is no allow-list gate for material or treatment claims anymore.
Every product's Draft A goes through owner review regardless, so instead
of pre-approving phrases, this skill always proposes its best candidate
value for material/treatment, always attached to the exact quoted source
phrase it came from, and the owner confirms or edits every single one
during review. Nothing bypasses that review step — there is no
"auto-trusted" path.

`data/stone-terms.json` still exists, but only as a HELPER, not a gate:
a small, owner-curated list of common trade-name-to-technical-value
mappings (e.g. "American Diamond" -> "cubic zirconia"), used only to
make the skill's suggested `value` faster and more accurate to confirm.
If a stone phrase isn't on the list, the skill still proposes its own
best-guess technical value — it just isn't pre-verified, so the owner's
review carries more weight for those specific candidates.

## Non-negotiable rules

1. **Every material/treatment/stone candidate is proposed WITH its exact
   source quote, always.** The candidate `value` and the `source.
   quotedPhrase` are both required together, every time — a candidate
   with no attached quote is not acceptable output, since the owner
   needs to see exactly what the source said to confirm or correct it
   quickly and accurately.

2. **Capture the maximal phrase, never truncate, even though there's no
   allow-list to enforce it mechanically anymore.** This rule matters
   MORE now, not less: a bad truncation ("18K gold-plated stainless
   steel" shortened to "18K gold") becomes the actual candidate a tired
   reviewer might rubber-stamp without noticing. Always capture the
   complete phrase including every adjacent qualifier (plating, base
   material, coating) as one candidate's quoted source, even if the
   proposed `value` itself is a shorter, cleaned-up version of it.

3. **Stone trade names get a suggested technical value, using
   `data/stone-terms.json` when available.** If the trade name in source
   text exact-matches an entry in `stone-terms.json`, use that mapping
   as the candidate `value` and set `stoneSource: "known-trade-term"`.
   If no match, still propose the skill's own best-guess technical value
   (e.g. "crystal" -> propose "glass or cubic zirconia, unclear from
   text" as the candidate, or similar honest hedging), and set
   `stoneSource: "unverified-guess"` so the owner knows this one wasn't
   backed by the reference list and deserves closer attention.

4. **Material/stone identity is never inferred from an image.** This
   still applies with no exceptions. On `sourceType: "fresh"`, material/
   stone candidates may only be proposed from the delimited
   `<owner-stated-facts>` block in the image-description prompt's output
   — never from the AI-generated descriptive prose, even as a
   "candidate for review." An image-generated phrase proposed as a
   candidate risks being confirmed by a fast-moving reviewer exactly the
   same way a laundered allow-list match would have been — the
   image-prose-is-never-a-source rule protects against that regardless
   of whether there's a gate downstream.

5. **Category must exactly match the fixed list:** `rings, earrings,
   nose-pins, bracelets, bangles, anklets, hair-accessories, necklaces,
   watches, pendants`. No other value is ever written to this field. If
   unclear, propose the closest guess as a candidate with low
   confidence noted, or leave null with a note if no reasonable guess
   exists.

6. **Strip known site boilerplate** (shipping timelines, dispatch
   windows, return-policy text, COD-availability notices) — record as
   `flaggedContent` type `boilerplate-discarded` with the removed text
   as `sourceContext`. If stripping boilerplate leaves NO product
   content whatsoever, add a mandatory note: "Source contained only
   boilerplate — likely not a product; confirm before assigning an ID."
   Be conservative: genuine product facts about packaging or
   presentation are NOT boilerplate.

7. **Strip review/rating markup entirely** (star ratings, "(N review)")
   — record as `flaggedContent` type `review-markup-discarded`. Never
   transcribe.

8. **The correct brand for this catalogue is "Morchadi Gems."** Any
   other brand reference (expected legacy mismatch: "Morchadi Jewels")
   is recorded as `flaggedContent` type `brand-mismatch`, quoting the
   exact text. Never silently corrected, never silently kept.

9. **Price figures are reference only, never real values, still.**
   Collapse ALL price figures found anywhere in source — including
   multiple figures across a size table — into one descriptive string
   in `pricing.referencePrice`. `pricing.price` and `pricing.mrp` are
   always `null` from this skill. Real pricing is always a separate,
   explicit owner decision during review, same as material now is.

10. **`personalized` default rule, unchanged:**
    - No personalisation language anywhere -> `personalized: false`.
    - Ambiguous customization-adjacent language -> `personalized: null`
      plus a note.
    - Explicit personalisation (engraving, chosen initial/name) ->
      `personalized: true`.
    - A plain colour or size variant alone is never sufficient for
      `true`.

11. **Variants vs. measurement data — explicit precedence, unchanged.**
    Named option values (e.g. "Size 6, 7, 8") populate `variants`. A
    measurement-mapping table tied to those values becomes one
    `attributes` entry, flattened to a readable string. Never drop the
    table; never invent a different structure for it.

12. **`suggestedCollections` may only draw from the site's real, fixed
    collection list.** If none confidently apply, leave empty. Never
    invent a new collection name.

13. **`subcategory` only when explicitly stated in source** — otherwise
    `null`.

14. **`productId` and `rawContent` are populated by pipeline code, NEVER
    by this skill.** `productId` follows the site's sequential
    convention (continuing from the next available number after P049),
    assigned once per candidate at Draft A creation and PERMANENTLY
    reserved even if later rejected.

15. **Every raw block produces exactly one Draft A object** — never
    skipped, never merged.

16. **Additional real facts get an open `attributes` entry** — weight,
    dimensions, chain length, movement type (e.g. "Quartz" for watches
    is a mechanism, not a stone — file it here, not as a stone
    candidate), anything real and stray.

17. **Grouping hint for review (used by the review tooling, not this
    skill directly):** this skill should propose candidates in a form
    that's easy to group — i.e., use consistent, clean candidate values
    for identical source phrases wherever possible, so the review stage
    can present "these 40 products all proposed 'gold-plated brass' —
    confirm as a group?" rather than 40 subtly-different-looking
    candidates that all mean the same thing.

## Output schema

```json
{
  "productId": "string",
  "sourceType": "fresh | migrated",
  "category": "string | null",
  "subcategory": "string | null",
  "variants": [{ "optionName": "string", "values": ["string"] }],
  "attributes": [
    {
      "label": "string",
      "value": "string",
      "displayTerm": "string | null",
      "stoneSource": "known-trade-term | unverified-guess | null",
      "source": {
        "origin": "migrated-text | owner-notes",
        "quotedPhrase": "string"
      } | null,
      "confirmed": false
    }
  ],
  "images": { "general": [], "variantImages": {} },
  "pricing": { "price": null, "mrp": null, "cost": null, "referencePrice": "string | null" },
  "personalized": "boolean | null",
  "suggestedCollections": ["string"],
  "sourceNotes": { "rawContent": "string | null", "referenceTitle": "string | null" },
  "flaggedContent": [
    { "type": "boilerplate-discarded | review-markup-discarded | brand-mismatch",
      "detail": "string", "sourceContext": "string | null" }
  ],
  "notes": ["string"],
  "status": "draft",
  "generatedBy": null
}
```

**New field: `confirmed` (boolean, on every attribute).** Starts `false`
on every proposed candidate, always. This is what the review stage
actually gates on — a product cannot proceed to description/meta
generation (Phase 2) while any attribute still has `confirmed: false`.
This is the mechanical enforcement of "always confirm per product."

## Worked example — migrated listing, fully proposed, awaiting confirmation

```json
{
  "productId": "P050",
  "sourceType": "migrated",
  "category": "rings",
  "subcategory": null,
  "variants": [{ "optionName": "Colour", "values": ["Golden", "Silver"] }],
  "attributes": [
    {
      "label": "Material",
      "value": "gold-plated brass",
      "displayTerm": null,
      "stoneSource": null,
      "source": { "origin": "migrated-text", "quotedPhrase": "gold-plated brass" },
      "confirmed": false
    },
    {
      "label": "Stone",
      "value": "cubic zirconia",
      "displayTerm": "American Diamond",
      "stoneSource": "known-trade-term",
      "source": { "origin": "migrated-text", "quotedPhrase": "American Diamond stones" },
      "confirmed": false
    }
  ],
  "images": { "general": [], "variantImages": {} },
  "pricing": { "price": null, "mrp": null, "cost": null, "referencePrice": "₹499 (old site)" },
  "personalized": false,
  "suggestedCollections": ["gifting"],
  "sourceNotes": { "rawContent": null, "referenceTitle": "Amethyst Purple & Emerald Vine Necklace" },
  "flaggedContent": [
    { "type": "boilerplate-discarded", "detail": "Removed shipping/return-policy paragraph",
      "sourceContext": "Dispatch within 2 days... Free returns within 7 days" }
  ],
  "notes": [],
  "status": "draft",
  "generatedBy": null
}
```