# Test Result: product SEO metadata pass

- **Date:** 2026-08-19
- **Plan:** none. This records the verification of
  [ADR-036](../decisions/ADR-036-product-seo-metadata-pass.md). There was no pre-written plan;
  the checks below are the ones the `morchadi-product-meta` skill requires, plus the gate.
- **Scope:** the `seo` block on all 49 products, the product page's `generateMetadata`, the
  image alt wiring, and the new validator and test coverage. Out of scope: the `Product`
  JSON-LD, which was not touched, and per-product Open Graph image assets, which do not exist.

## Gate

| Step | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | Pass, no output |
| Lint | `npx next lint` | Pass, no warnings or errors |
| Tests | `npx vitest run` | 38 files, 762 tests, all passing |
| Catalogue validation | `node scripts/validate-products.mjs` | PASS, with three advisories |
| Build | `npm run build` | Compiled successfully, 49 product pages prerendered |

The validator's three advisories: nine products above the 60% discount house style (ADR-027,
the owner's real prices), four descriptions outside the word range (ADR-035, the four products
still awaiting owner copy), and nine products quoting an amount in their metadata, which is the
PRICE-DATED advisory this pass added.

## What was measured, and how

Character counts were measured programmatically, never estimated, by counting **code points**
so the rupee sign counts once rather than as its UTF-16 length. Every field of every product
was measured in one run before anything was written to `data/products.json`; the fields that
came back out of range were rewritten and re-measured until the run came back clean.

The same measurement now runs in the gate from two sides: `validate-products.mjs` fails the
build, `lib/product-seo.test.ts` fails the suite.

| Bound | Field | Why |
| --- | --- | --- |
| 50-60 | `metaTitle` | Google truncates by pixel width near 600px, so 60 is generous rather than exact. The floor is there because a short title wastes the one line a result gets |
| 140-160 | `metaDescription` | Under 140 leaves SERP space unused, over 160 is cut mid-thought |
| 40-70 | `ogTitle` | What a social card renders without wrapping oddly |
| 200 max | `ogDescription` | The most any platform shows. WhatsApp shows roughly the first 80, so the pitch has to land there |
| 125 max | every image alt | Roughly where a screen reader stops being useful |

## Cases run

| ID | Check | How | Result |
| --- | --- | --- | --- |
| TC-01 | All 49 products carry a non-empty `seo` block | validator + test | Pass |
| TC-02 | Every field inside its measured bound | code-point count, validator + test | Pass, 49/49 |
| TC-03 | No two products share a `metaTitle` | ledger, validator, test | Pass, 49 unique |
| TC-04 | No two products share a `primaryKeyword` | ledger, validator, test | Pass, 49 unique |
| TC-05 | No field clones another within a product | validator + test | Pass |
| TC-06 | One alt per photograph, none identical | validator + test | Pass, 50 alts for 50 images |
| TC-07 | No alt opens "image of" or "photo of" | validator + test | Pass |
| TC-08 | `ogImage` is the product's own photograph | validator + test | Pass |
| TC-09 | Anti-tarnish claimed only where tagged | validator + test | Pass, 8 tagged, 41 silent |
| TC-10 | No karat, hallmark or sterling in any `seo` string | `lib/product-copy.test.ts`, extended to `seo` | Pass |
| TC-11 | No em dash in any `seo` string | `lib/copy-dashes.test.ts`, extended to `seo` | Pass |
| TC-12 | No barred promotional adjective | validator + test | Pass |
| TC-13 | A quoted amount is the product's price or the ₹799 threshold | validator + test | Pass, 9 products quote one |
| TC-14 | The share-card pitch lands inside the first 80 characters | test | Pass after one rewrite |
| TC-15 | `generateMetadata` publishes the record's fields | test, all 49 | Pass |
| TC-16 | Twitter card mirrors Open Graph | test, all 49 | Pass |
| TC-17 | No title carries the brand twice | test, all 49 | Pass |
| TC-18 | `og:type` is `product` | test | Pass |
| TC-19 | An unknown product id is `noindex` | test | Pass |
| TC-20 | The rendered HTML carries the fields | grep over the built `P032.html` | Pass, below |
| TC-21 | A lead angle never runs three products consecutively | ledger | Pass |
| TC-22 | An alt-text opening word never repeats across the batch | ledger | Pass, 50 distinct openings |

### TC-20, the rendered page

`.next/server/app/product/P032.html`, after the build:

```html
<title>Gold-Plated Peacock Nath with a Deep Pink-Red Stone</title>
<meta name="description" content="A peacock curves along a pave hoop, set with a deep pink-red stone and one hanging pearl-look bead. Gold-plated brass, screw fit for a pierced nose."/>
<meta name="og:type" content="product"/>
<link rel="canonical" href=".../product/P032"/>
<meta property="og:title" content="Gold-Plated Peacock Nath, Pearl-Look Drop, ₹109"/>
<meta property="og:image" content=".../products/P032.webp"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="Curved peacock nose ring in gold tone with a deep pink-red stone and a pearl-look bead below"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="Gold-Plated Peacock Nath, Pearl-Look Drop, ₹109"/>
```

The title had to be fixed to get here. The first build rendered
`Gold-Plated Peacock Nath with a Deep Pink-Red Stone · Morchadi Gems` at 67 characters, because
`app/layout.tsx` sets a `%s · Morchadi Gems` template and the page inherited it. The page now
returns the title as `absolute`. TC-17 is the regression test.

## Defects found and fixed during the run

| # | What | Fix |
| --- | --- | --- |
| 1 | Three meta descriptions measured 161 to 163 characters | Rewritten and re-measured to inside 140-160 |
| 2 | P005 quoted ₹199 in its `ogTitle` with no PRICE-DATED record | Ledger entry added |
| 3 | The layout's brand template pushed every rendered title to 67-77 characters | The product page returns an absolute title |
| 4 | P024's `ogDescription` had no clause break inside the 80 characters WhatsApp shows | Rewritten so the first clause closes at 79 |
| 5 | Only 2 of 49 descriptions carried a trust nudge, which is not the rotation the skill asks for | 13 more added across returns, dispatch and delivery. 34 deliberately carry none |

## The collision ledger

Kept as the batch was written and consulted before each product, rather than reconstructed
afterwards. `Chars` is the measured `metaTitle` length, `Desc chars` the measured
`metaDescription` length.

| ID | Primary keyword | Meta title | Chars | Desc chars | Lead | Alt opens | Nudge |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P001 | gold-plated initial ring | Gold-Plated Initial Ring on an Adjustable Wave Band | 51 | 147 | design | Slim | 7-day returns |
| P002 | glass locket necklace | Glass Locket Necklace, Openable Teardrop in Gold Tone | 53 | 155 | design | Gold-plated | none |
| P003 | floating locket with birth-month charms | Heart Floating Locket with Twelve Birth-Month Charms | 52 | 152 | occasion | Heart-shaped | delivery in 7 days |
| P004 | adjustable crystal heart ring | Clear Crystal Heart Ring on an Adjustable Gold Band | 51 | 149 | design | Faceted | none |
| P005 | silver-tone signet ring | Silver-Tone Initial Signet Ring, Engraved Marquise Face | 55 | 158 | durability | Narrow | none |
| P006 | floating locket pendant | Floating Locket Pendant in Oval, Heart, Round or Square | 55 | 146 | design | Four | dispatch in 2 days |
| P007 | gold-plated hug ring | Gold-Plated Hug Ring with Two Hands, Adjustable Cuff | 52 | 152 | occasion | Open | none |
| P008 | silver-tone twisted bow ring | Silver-Tone Bow Ring with a Twisted Rope Band, Adjustable | 57 | 160 | design | Rhodium-plated | none |
| P009 | watch dial ring | Watch Dial Ring in Stainless Steel, Decorative Only | 51 | 157 | durability | Stainless | none |
| P010 | mini watch ring | Mini Watch Ring in Silver or Golden Stainless Steel | 51 | 152 | design | Miniature | none |
| P011 | gold-plated love knot ring | Gold-Plated Love Knot Ring on a Plain Free-Size Band | 52 | 149 | occasion | Fine | 7-day returns |
| P012 | oversized clear heart ring | Oversized Clear Heart Ring with a Scalloped Setting | 51 | 156 | design | Large | none |
| P013 | rose gold-plated stacking ring | Rose Gold-Plated Stacking Ring with a Pink CZ Baguette | 54 | 159 | design | Textured | none |
| P014 | green baguette stacking ring | Gold-Plated Stacking Ring with an Emerald-Green Baguette | 56 | 154 | occasion | Green | none |
| P015 | red stone thread ring | Red Stone Thread Ring, Bezel-Set on a Fine Gold Band | 52 | 152 | design | Hair-fine | none |
| P016 | pink stone thread ring | Pink Stone Thread Ring on a Hair-Fine Gold-Plated Band | 54 | 150 | occasion | Small | dispatch in 2 days |
| P017 | clear stone thread ring | Clear Cubic Zirconia Thread Ring, Hair-Fine Gold Band | 53 | 160 | price | Clear | none |
| P018 | olive green thread ring | Olive Green Stone Thread Ring, Fine Gold-Plated Band | 52 | 154 | design | Olive | none |
| P019 | cubic zirconia bow ring | Cubic Zirconia Bow Ring in Silver Tone, Adjustable Fit | 54 | 156 | design | Two | none |
| P020 | gold-plated ribbon bow ring | Gold-Plated Ribbon Bow Ring with Nothing Set Into It | 52 | 158 | price | Polished | none |
| P021 | rainbow eternity ring | Rainbow Eternity Ring, Channel-Set Baguettes in Gold | 52 | 153 | design | Eternity | 7-day returns |
| P022 | beaded bracelet watch | Beaded Bracelet Watch, Anti-Tarnish Gold-Plated Band | 52 | 151 | durability | Oval | none |
| P023 | meenakari bracelet watch | Meenakari Bracelet Watch with Ghungroo Bells and Enamel | 55 | 157 | design | Round | none |
| P024 | multicolour cluster stud earrings | Multicolour Cluster Stud Earrings in Gold-Plated Brass | 54 | 144 | design | Cluster | 7-day returns |
| P025 | silver-plated pink stud earrings | Silver-Plated Pink Leaf Stud Earrings, Openwork Frame | 53 | 155 | occasion | Openwork | none |
| P026 | silver-plated blue stud earrings | Silver-Plated Blue Stud Earrings with a Square Centre | 53 | 156 | occasion | Deep | none |
| P027 | mint green stud earrings | Mint Green Floral Studs in Gold-Plated Brass, Frosted | 53 | 154 | design | Frosted | none |
| P028 | pink flower stud earrings | Pink Flower Stud Earrings, Six Petals in Gold Plate | 51 | 152 | occasion | Six | dispatch in 2 days |
| P029 | milled silver-tone petal studs | Pink Petal Stud Earrings in a Milled Silver-Tone Frame | 54 | 156 | design | Five | none |
| P030 | gold-plated halo stud earrings | Gold-Plated Halo Stud Earrings with a Milky Centre | 50 | 144 | design | Milky | none |
| P031 | silver-plated nath | Silver-Plated Nath with a Floral Teardrop, Screw Fit | 52 | 157 | price | Pave-set | none |
| P032 | gold-plated peacock nath | Gold-Plated Peacock Nath with a Deep Pink-Red Stone | 51 | 148 | design | Curved | none |
| P033 | clear stone peacock nath | Peacock Nath in Clear Cubic Zirconia, Gold-Plated Hoop | 54 | 156 | occasion | Peacock | none |
| P034 | minimalist gold-plated nath | Minimalist Gold-Plated Nath, Open Pressure-Fit Hoop | 51 | 146 | design | Thin | 7-day returns |
| P035 | bridal cluster nath | Silver-Plated Floral Cluster Nath, Screw Fit for Brides | 55 | 156 | occasion | Silver-tone | none |
| P036 | enamel kada bangle | Orange Enamel Kada Bangle with Raised Gold-Tone Flowers | 55 | 160 | durability | Solid | none |
| P037 | pink flower bracelet | Pink Flower Bracelet with an Anti-Tarnish Gold Vine | 51 | 146 | design | Leafy | 7-day returns |
| P038 | multicolour tulip bracelet | Multicolour Tulip Bracelet on a Waved Gold Bar Chain | 52 | 158 | design | Waved | none |
| P039 | pink tulip bracelet | Pink Tulip Bracelet, Ovals and Marquises in Gold Tone | 53 | 146 | durability | Alternating | 7-day returns |
| P040 | blue tulip bracelet | Blue and Green Tulip Bracelet on a Waved Gold Chain | 51 | 157 | occasion | Blue | none |
| P041 | kashmiri ghungroo bangles | Kashmiri Ghungroo Bangles in Packs of Four or Eight | 51 | 160 | design | Clusters | free shipping over ₹799 |
| P042 | purple glass bangle set | Royal Purple Glass Bangle Set of Sixteen with Bells | 51 | 158 | design | Sixteen | none |
| P043 | green glass bangle set | Emerald-Green Glass Bangles, Set of Sixteen for Teej | 52 | 159 | occasion | Lacquered | none |
| P044 | silver-plated payal | Silver-Plated Payal, Snake Chain Anklets, Set of Two | 52 | 149 | price | Pair | dispatch in 2 days |
| P045 | evil eye anklet | Black Evil Eye Anklet with a Spiral Charm, Set of Two | 53 | 158 | design | Strand | none |
| P046 | gold-plated clover anklet | Anti-Tarnish Clover Charm Anklet in Gold-Plated Steel | 53 | 152 | durability | Cable | none |
| P047 | tulip bow hair clip | Pink Tulip Bow Hair Clip in Organza and Satin at ₹49 | 52 | 157 | price | Organza | none |
| P048 | satin bow hair clip | Long Tail Satin Bow Hair Clip, Four Finishes to Pick | 52 | 153 | design | Satin | 7-day returns |
| P049 | satin scrunchies set | Satin Scrunchies, a Set of Four with Covered Elastic | 52 | 146 | durability | Set | 7-day returns |

## Rotation summary

| Lead angle | Products | | Trust nudge | Products |
| --- | --- | --- | --- | --- |
| design | 25 | | none | 34 |
| occasion | 12 | | 7-day returns | 9 |
| durability | 7 | | dispatch in 2 days | 4 |
| price | 5 | | delivery in 7 days | 1 |
| | | | free shipping over ₹799 | 1 |

No lead angle runs three products consecutively. The free-shipping nudge is used once, on P041,
the only product sold in packs where a basket over ₹799 is what the product is. On a catalogue
topping out at ₹499 it would be misleading anywhere else.

## Not tested

- **Whether the cards actually render on WhatsApp, Facebook or X.** That needs the live domain
  and each platform's debugger, and WhatsApp caches a preview aggressively, so the first fetch
  is the one that counts. The tags are correct and correctly sized; that they unfurl well is
  unverified.
- **Whether the square product photographs crop acceptably into 1200x630.** The size is
  declared, not rendered. Per-product share images are a separate asset job.
- **Search performance.** Nothing here predicts a ranking.
