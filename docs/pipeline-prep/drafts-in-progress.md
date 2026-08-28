# Drafts in progress

The register of every product id that has been assigned and not yet published — Draft A objects in
`content-pipeline/drafts/`, and, since [ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md),
migration raw blocks in `content-pipeline/incoming/` that extraction has not reached yet. One row
per id, moved by hand to [`products-completed.md`](products-completed.md) when its product is
published.

**Nothing reads this file, and only one thing writes to it.**
`scripts/prepare-migration-batch.mjs` appends `queued` rows, because it is the code that assigns
those ids and a register that could disagree with an assignment would be worse than no register.
Every other row and every stage change is typed by hand. It is a human index over an untracked
directory, which is exactly why it is kept here in tracked documentation: if `content-pipeline/`
is lost, this table is the record that it existed and what was in it.

## Stages

`Stage` is one of these six, in order. They are the manual workflow of
[`README.md`](README.md#the-manual-workflow-raw-content-to-published-product), not states any
code sets — with one exception, noted in the first row.

| Stage | Means |
| --- | --- |
| `queued` | Stage 0 has assigned the product id and written its raw block to `content-pipeline/incoming/{batch-id}/PNNN/raw-block.json`. The source text, variants, categories and image suggestions are transcribed; **Draft A extraction has not run**, so there are no candidate values, no quoted phrases and nothing to review yet. Added by [ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md). **The one stage a script writes**: `scripts/prepare-migration-batch.mjs` appends these rows itself, because it is also what assigns the id |
| `extracted` | The skill has produced the draft and `validate-draft-a.mjs` passes. Every attribute is `confirmed: false`. Untouched by human eyes |
| `in-review` | The owner is working through the candidate values, confirming or editing each one against its quoted source phrase |
| `confirmed` | Every attribute is `confirmed: true`. Price and images are still absent — those are the next manual step, not part of review |
| `priced-and-shot` | `pricing.price` and at least one `images.general` entry assigned by hand. This is the state `validatePublishReadiness` is designed to check |
| `awaiting-publish` | Written into `data/products.json` as a `draft` record by the Phase 2 orchestration skill ([ADR-053](../decisions/ADR-053-draft-a-to-product-orchestration.md)), and blocked on the final owner approval. `npm run publish:product PNNN` is the step that turns it on |

A draft that is rejected in review is not a stage. Delete its row, note the id under
[Rejected ids](#rejected-ids) below, and never reuse the number.

**A `queued` row is not a draft yet.** Its file is under `content-pipeline/incoming/`, not
`content-pipeline/drafts/`, and `scripts/validate-draft-a.mjs` would fail it — correctly, because
a raw block is not a Draft A object. It becomes one when extraction runs and the row moves to
`extracted` by hand.

## Register

| Product ID | Reference Title (old site) | Category | Stage | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- |
| P114 | Double Butterfly Wing Silver-Plated Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `137` |
| P116 | DC Jewelry Dainty Flower Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `140` |
| P128 | DC Jewelry Petal Shine Finger Ring – Rosegold &#124; Adjustable American Diamond Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `158` |
| P136 | DC Jewelry Sparkling Criss-Cross Ring – Rosegold Polish &#124; Adjustable AD Finger Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `166` |
| P138 | DC Jewelry Mirror Drop Oval Ring – Designer Statement Ring with CZ & Bead Charm | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `168` |
| P142 | DC Jewelry Silver Dolphin Tail & Heart Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `172` |
| P148 | DC Jewelry Round Stone Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `178` |
| P150 | DC Jewelry Minimalist Open Bar Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `180` |
| P157 | Cowrie Shell CZ Gold-Plated Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `196` |
| P164 | Pearl & CZ Bar Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `208` |
| P168 | Geometric T-Bar CZ Gold-Plated Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `213` |
| P169 | Twin Rose Design Gold-Plated Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `214` |
| P171 | Bar & Pebble CZ Gold-Plated Minimalist Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `216` |
| P174 | 3mm crystal jelly glass bangles (Set of 8) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `471` |
| P177 | DC Jewelry butterfly adjustable ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `474` |
| P179 | DC Jewelry double rose adjustable ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `476` |
| P219 | Anti Tarnish Lover Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `519` |
| P220 | Anti-Tarnish Geometric Band Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `520` |
| P221 | Anti Tarnish Elysian Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `522` |
| P222 | Anti Tarnish Nova Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `523` |
| P223 | Anti Tarnish Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `524` |
| P224 | Anti-Tarnish Gold-Plated Open Adjustable Stone-Studded Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `525` |
| P225 | Anti-Tarnish Infinity Link Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `526` |
| P226 | Anti-Tarnish Double Band Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `527` |
| P227 | Anti-Tarnish Gold-Plated Crystal Cut-Out Band Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `528` |
| P228 | Anti-Tarnish Sparkle Band Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `529` |
| P231 | Anti Tarnish Infinity Glam Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `532` |
| P232 | Anti-Tarnish "Duo Gleam" Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `533` |
| P233 | Anti-Tarnish Stone-Studded Adjustable Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `534` |
| P234 | Anti-Tarnish V-Shape Chevron Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `535` |
| P235 | Anti Tarnish Twisted Solitaire Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `536` |
| P236 | Anti Tarnish Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `537` |
| P237 | Anti-Tarnish Linked Infinity Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `538` |
| P238 | Anti-Tarnish Twin Wave Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `539` |
| P239 | Anti-Tarnish Infinity Wave Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `540` |
| P250 | Anti-Tarnish Multi-Color Bamboo Style Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `636` |
| P252 | Anti-Tarnish Multi-Color Textured Enamel Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `638` |
| P262 | Anti-Tarnish Multi-Color Bamboo Style Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `648` |
| P267 | Anti-Tarnish Pink Diamond Pattern Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `653` |
| P268 | Anti-Tarnish Pink Diamond Pattern Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `654` |
| P274 | Anti-Tarnish Red & White Modernist Enamel Kada | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `660` |
| P275 | Anti-Tarnish Monochrome Block Enamel Kada | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `661` |
| P276 | Anti-Tarnish Black Greek Key Kada | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `662` |
| P277 | Anti-Tarnish Minimalist Gold Loop Kada | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `663` |
| P278 | Anti-Tarnish Black Marble Enamel Kada | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `664` |
| P291 | Golden Rose Heart Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `689` |
| P293 | Emerald Women's Round Pendant | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `692` |
| P294 | Cute Multi-Charm Necklace | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `695` |
| P296 | Starburst Flower Pendant Necklace - Anti-Tarnish Gold Jewelry | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `700` |
| P297 | Anti Tarnish Personalized Initial and Heart Necklace | `necklaces` | `priced-and-shot` | 2026-08-25 | batch `2026-08-23-batch-01`, Odoo id `701`. personalized left null — explicit "Personalized Initial" language but no initial-selection option in export; owner resolves mechanism. 2026-08-25: owner-instructed batch confirmation + pricing + image confirmation applied, but personalized left null by explicit owner instruction — validatePublishReadiness fails on D3 until the owner resolves the initial-selection mechanism; Phase 2 deliberately not run |
| P302 | Minimalist North Star Pendant Necklace - Anti-Tarnish Gold Jewelry | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `712` |
| P303 | Textured Heart Pendant Necklace with Diamond - Anti-Tarnish Gold Jewelry | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `714` |
| P304 | Vintage-Inspired Key Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `715` |
| P305 | Anti tarnish Charm Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `717` |
| P306 | Starfish Pendant Beaded Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `718` |
| P307 | Multi-Charm Butterfly and Floral Necklace - Anti-Tarnish Gold Jewelry | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `719` |
| P308 | Designer-Inspired Coin and Initial Necklace - Anti-Tarnish Gold Jewelry | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `720` |
| P309 | Floral Heart Locket Necklace | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `721` |
| P310 | Anti tarnish Heart Pendant  Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `722` |
| P311 | Emerald Heart Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `723` |
| P315 | Mint Green & White CZ Choker Necklace Set | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `737` |
| P316 | Green Kundan Pearl Choker Necklace Set | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `738` |
| P325 | Silver-Plated Blue & Crystal Floral Stud Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `751` |
| P326 | Silver-Plated Pink Drop Earrings with CZ Stones | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `752` |
| P335 | Trendy Fashion Rings for Women | `rings` _(extraction PROPOSAL — owner confirmation required)_ | `priced-and-shot` | 2026-08-25 | batch `2026-08-23-batch-01`, Odoo id `765`. 2026-08-25: owner-instructed batch confirmation + pricing + image confirmation applied, but reference price ₹10 sits below the catalogue hard floor (MIN_PRICE ₹25, price-band gate) and was flagged at extraction as a probable placeholder — Phase 2 held until the owner sets a real price |
| P336 | Trendy Fashion Rings for Women | `rings` _(extraction PROPOSAL — owner confirmation required)_ | `priced-and-shot` | 2026-08-25 | batch `2026-08-23-batch-01`, Odoo id `766`. 2026-08-25: owner-instructed batch confirmation + pricing + image confirmation applied, but reference price ₹10 below the ₹25 catalogue floor — Phase 2 held until the owner sets a real price |
| P337 | Trendy Fashion Rings for Women | `rings` _(extraction PROPOSAL — owner confirmation required)_ | `priced-and-shot` | 2026-08-25 | batch `2026-08-23-batch-01`, Odoo id `767`. 2026-08-25: owner-instructed batch confirmation + pricing + image confirmation applied, but reference price ₹10 below the ₹25 catalogue floor — Phase 2 held until the owner sets a real price |
| P353 | Anti Tarnish Elara Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `788` |
| P359 | kashmiri ghungroo bangles | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `795` |
| P361 | Elegant Silver Knot Adjustable Ring for Women & Girls | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `801` |
| P362 | Gold Hug Hands Adjustable Ring for Women & Girls | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `802` |
| P366 | Anti Tarnish Multicolor Adjustable Finger Ring For Women | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `807` |
| P369 | Gold-Plated Anti Tarnish Green Geometric Pendant | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `811` |
| P370 | Gold Plated Anti Tarnish Nail Bracelet For Women | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `813` |
| P371 | Floating Teardrop Locket (Without Charm) | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `817`. **sourceNotes.rawContent:** accepted as a knownStub with 40 characters — extraction will have nothing to quote, so this one needs owner-supplied copy before Draft A |
| P382 | Infinity Gold-plated Stainless Steel Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `830` |
| P400 | Minimalist Stainless Steel Ring with Green Crystal Stone | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `852` |
| P401 | Minimalist Stainless Steel Ring with White Crystal Stone | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `853` |
| P402 | Minimalist Stainless Steel Ring with White Crystal Red | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `854` |
| P403 | Minimalist Stainless Steel Ring with White Crystal Pink | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `855` |
| P405 | Minimalist Vintage Square Synthetic Gemstone Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `857` |
| P406 | Minimalist Vintage Square Synthetic Gemstone Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `858` |
| P407 | Brass Initial Letter adjustable ring | _(none)_ | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `860` |
| P409 | Set of 8 Viral Jelly Bangle (Mint Tint) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `862` |
| P410 | Set of 8 Viral Jelly Bangle (Hot Pink) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `863` |
| P411 | Set of 8 Viral Jelly Bangle (Smoke Grey) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `864` |
| P412 | Set of 8 Viral Jelly Bangle (Ruby Red) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `865` |
| P413 | Set of 8 Viral Jelly Bangle (Ocean) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `866` |
| P414 | Set of 8 Viral Jelly Bangle (Light Multi) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `867` |
| P415 | Set of 8 Viral Jelly Bangle (Crystal Clear) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `868` |
| P416 | Set of 8 Viral Jelly Bangle (Dark Multi) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `869` |
| P476 | Gold- Plated Traditional Nath – Vibrant Ruby & Emerald Green Stone Studded | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `932` |
| P486 | Gold-Plated Multi-Stone Traditional Nath – Vibrant Ruby, Emerald & White Stone | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `942` |
| P489 | Silver-Plated Floral Cluster Nath – Sparkling White Zirconia Studded | `nose-pins` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `945` |
| P490 | Gold-Plated Minimalist Stone Nath – Sparkling Dainty with Teardrop Charm | `nose-pins` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `946` |
| P491 | Gold-Plated Traditional Peacock Nath – Shimmering White Stone with Pearl Drop | `nose-pins` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `947` |
| P492 | Gold-Plated Traditional Peacock Nath – Sparkling Ruby Red & White Stone with Pearl Drop | `nose-pins` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `948` |
| P493 | Silver-Plated Floral Teardrop Nath – Sparkling White Stone Studded | `nose-pins` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `949` |
| P505 | Vibrant Emerald Green Glass Bangle Set with Golden Ghoonghroo Accents – 16-Piece | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `961` |
| P506 | Royal Purple Glass Bangle Set with Golden Ghoonghroo Accents – 16-Piece | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `962` |
| P514 | Gold Heart Locket Personalized Necklace | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `976` |
| P515 | Gold Oval Locket Personalized Necklace | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `977` |
| P531 | The Cutest Pinterest-y Birthday Hamper 🎀 | `gift-hampers` | `priced-and-shot` | 2026-08-25 | batch `2026-08-23-batch-01`, Odoo id `994`. personalized left null (Initial Letter Ring in contents, no letter option); COD-restriction notice stripped as boilerplate but flagged as a possibly real payment constraint. 2026-08-25: owner-instructed batch confirmation + pricing + image confirmation applied, but personalized left null by explicit owner instruction (Initial Letter Ring, no letter option) — readiness fails on D3; Phase 2 deliberately not run |
| P540 | Rose Vine Anti Tarnish tulip Bracelet for Women | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1006` |
| P541 | Purple Floral Bow Anti Tarnish Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1007` |
| P542 | Anti Tarnish Tulip Crystal Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1008` |
| P551 | Anti Tarnish Gold CZ Tennis Bracelet for Women | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1017` |
| P552 | Anti Tarnish Gold CZ Tennis Bracelet with Square Solitaire Stone | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1018` |
| P556 | Anti Tarnish Dainty Gold CZ Tennis Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1022` |
| P560 | Blue Tulip Anti-Tarnish Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1029` |
| P561 | Pink Tulip Anti-Tarnish Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1030` |
| P562 | Multicolour Tulip Anti-Tarnish Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1031` |
| P563 | Pink Flower Anti-Tarnish Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1032` |
| P578 | Black Evil Eye Spiral Charm Anklet – Set of 2 | `anklets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1048` |
| P579 | Clover Charm Gold Anti-Tarnish Anklet | `anklets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1049` |
| P581 | Silver Snake Chain Ball Anklet – Set of 2 | `anklets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1051` |
| P582 | Orange Enamel Floral Kada – Gold Plated Anti-Tarnish | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1052` |
| P583 | Pink Tulip Bow Hair Clip | `hair-accessories` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1053` |
| P599 | Deluxe Jewelry Gift Hamper for her | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1069` |
| P602 | Traditional Antique Gold Kundan Bracelet Watch for Women &#124; | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1072` |
| P604 | Red Meenakari Gold Plated Ethnic Wrist Watch with Ghungroo | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1075` |
| P605 | Green Meenakari Gold Plated Ethnic Wrist Watch with Ghungroo | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1076` |
| P607 | Luxury Silver Crystal Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1079` |
| P618 | Vintage Anti-Tarnish Gold Beaded Bracelet Watch for Women | `watches` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1090` |
| P631 | Green Heart Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1103` |
| P632 | Emerald Green Baguette Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1104` |
| P633 | Emerald Green Stone Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1105` |
| P637 | Purple Enamel Flower Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1109` |
| P638 | Vintage-Style Amethyst Necklace with Crystal Leaf Halo | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1110` |
| P640 | 3D Red Rose Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1112` |
| P641 | Clear Crystal Baguette Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1113` |
| P642 | Mother of Pearl Flower Medallion Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1114` |

**The example row is not a reservation, and P050 is no longer next.** An id is reserved by the
first file named after it, never by appearing in a table. ADR-054 retired **P050–P100**
permanently and starts the Odoo migration at **P101**; the reconciled rule for both intake paths
is in [`content-pipeline/drafts/README.md`](../../content-pipeline/drafts/README.md#id-reservation-two-paths-one-rule).

## Rejected ids

Ids assigned and later rejected — in review, or at the `queued` stage during duplicate
curation. Permanently retired — never reused, per
[ADR-051 decision 4](../decisions/ADR-051-draft-a-content-pipeline.md). Gaps in the sequence are
correct and expected.

| Product ID | Rejected | Why |
| --- | --- | --- |
| P135 | 2026-08-25 | duplicate listing of **P108** (cluster A-3): entire 3-photo gallery byte-identical to P108's live gallery — [merge proposal](duplicate-cluster-merge-proposal.md), owner-approved; rejected at `queued`, before review |
| P141 | 2026-08-25 | duplicate listing of **P115** (cluster B-6): sole photo is the live P115 main — [merge proposal](duplicate-cluster-merge-proposal.md), owner-approved; rejected at `queued`, before review |
| P144 | 2026-08-25 | duplicate listing of **P118** (cluster B-9): sole photo is the live P118 main — [merge proposal](duplicate-cluster-merge-proposal.md), owner-approved; rejected at `queued`, before review |
| P146 | 2026-08-25 | duplicate listing of **P110** (cluster B-7): sole photo is the live P110 main — [merge proposal](duplicate-cluster-merge-proposal.md), owner-approved; rejected at `queued`, before review |
| P149 | 2026-08-25 | duplicate listing of **P122** (cluster B-10): sole photo is the live P122 main — [merge proposal](duplicate-cluster-merge-proposal.md), owner-approved; rejected at `queued`, before review |
| P159 | 2026-08-25 | duplicate listing of **P109** (cluster B-8): sole photo is the live P109 main — [merge proposal](duplicate-cluster-merge-proposal.md), owner-approved; rejected at `queued`, before review |
| P160 | 2026-08-25 | duplicate listing of **P106**/**P120** (cluster A-5): sole photo is the KI-001 shared live main — [merge proposal](duplicate-cluster-merge-proposal.md), owner-approved; rejected at `queued`, before review |
| P167 | 2026-08-25 | duplicate listing of **P115** (cluster B-6): sole photo is the live P115 main — [merge proposal](duplicate-cluster-merge-proposal.md), owner-approved; rejected at `queued`, before review |
| P354 | 2026-08-25 | same product as live **P010** (cluster A-4, owner-confirmed): its 2 photos are a subset of P360's; candidate gallery additions staged for P010 review — [merge proposal](duplicate-cluster-merge-proposal.md), owner-approved; rejected at `queued`, before review |
| P360 | 2026-08-25 | same product as live **P010** (cluster A-4, owner-confirmed): main byte-identical to live `P010.webp`; candidate gallery additions staged for P010 review — [merge proposal](duplicate-cluster-merge-proposal.md), owner-approved; rejected at `queued`, before review |
