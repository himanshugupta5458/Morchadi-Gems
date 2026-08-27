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
| P103 | Anti Tarnish Love Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `62` |
| P105 | DC Jewelry Twinkle Duo Ring – Star & Square | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `123` |
| P107 | DC Jewelry Golden Heart Band Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `126` |
| P111 | DC Jewelry Floral Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `133` |
| P112 | DC Jewelry Petal Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `134` |
| P113 | DC Jewelry Radiant Bloom Statement Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `135` |
| P114 | Double Butterfly Wing Silver-Plated Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `137` |
| P116 | DC Jewelry Dainty Flower Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `140` |
| P124 | DC Jewelry Finger Ring – Rosegold Polished &#124; American Diamond Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `154` |
| P125 | DC Jewelry Floral Elegance Ring – Rosegold Finish &#124; Premium AD Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `155` |
| P126 | DC Jewelry Floral Elegance Ring – Rosegold Finish &#124; Premium AD Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `156` |
| P127 | DC Jewelry Classic Round Solitaire Ring – Rosegold Polish &#124; CZ Adjustable Finger Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `157` |
| P128 | DC Jewelry Petal Shine Finger Ring – Rosegold &#124; Adjustable American Diamond Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `158` |
| P129 | DC Jewelry Knot Charm Ring – Rosegold Finish &#124; Adjustable CZ Finger Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `159` |
| P130 | DC Jewelry Baguette Sparkle Ring – Rosegold Polish &#124; Adjustable AD Fashion Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `160` |
| P131 | DC Jewelry Double T CZ Ring – Rosegold Finish &#124; Adjustable Statement Finger Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `161` |
| P132 | DC Jewelry Solitaire Glow Ring – Rosegold Polish &#124; Adjustable American Diamond Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `162` |
| P133 | DC Jewelry Geometric Glamour Ring – Rosegold &#124; Adjustable Finger Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `163` |
| P134 | DC Jewelry Oval Halo Ring – Rosegold Finish &#124; Adjustable CZ Fashion Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `164` |
| P136 | DC Jewelry Sparkling Criss-Cross Ring – Rosegold Polish &#124; Adjustable AD Finger Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `166` |
| P137 | DC Jewelry Twin Heart Adjustable Ring – Rosegold Love Edition with CZ Stones | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `167` |
| P138 | DC Jewelry Mirror Drop Oval Ring – Designer Statement Ring with CZ & Bead Charm | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `168` |
| P139 | DC Jewelry Infinity Leaf Band – Stylish CZ Finger Ring in Rosegold Polish | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `169` |
| P140 | DC Jewelry Twisted Elegance Ring – Dual Band CZ Adjustable Ring in Rosegold | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `170` |
| P142 | DC Jewelry Silver Dolphin Tail & Heart Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `172` |
| P143 | DC Jewelry Wide Criss-Cross Rose Gold Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `173` |
| P145 | DC Jewelry Key-Themed Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `175` |
| P147 | DC Jewelry Teardrop Solitaire Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `177` |
| P148 | DC Jewelry Round Stone Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `178` |
| P150 | DC Jewelry Minimalist Open Bar Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `180` |
| P151 | Silver-Plated Adjustable AD Stone Criss-Cross Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `183` |
| P152 | DC Jewelry Modern Bar Stone Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `184` |
| P153 | DC Jewelry Cross Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `191` |
| P154 | Cushion Halo CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `192` |
| P155 | Floral Halo Solitaire CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `193` |
| P156 | "I ❤ U" Message CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `195` |
| P157 | Cowrie Shell CZ Gold-Plated Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `196` |
| P158 | Wavy CZ Band Gold-Plated Adjustable Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `197` |
| P161 | Bow Knot CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `200` |
| P162 | Silver-Plated Adjustable Floral Open AD Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `202` |
| P163 | Silver-Tone Star & Crystal Adjustable Ring Set | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `204` |
| P164 | Pearl & CZ Bar Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `208` |
| P165 | Modern Geometric CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `210` |
| P166 | DC Jewelry Heart shape Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `211` |
| P168 | Geometric T-Bar CZ Gold-Plated Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `213` |
| P169 | Twin Rose Design Gold-Plated Adjustable Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `214` |
| P170 | Double Emerald-Cut CZ Silver-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `215` |
| P171 | Bar & Pebble CZ Gold-Plated Minimalist Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `216` |
| P172 | Rose Gold-Plated AD Stone Band Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `217` |
| P173 | Double Disk CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `218` |
| P174 | 3mm crystal jelly glass bangles (Set of 8) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `471` |
| P175 | DC Jewelry Music Spark Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `472` |
| P176 | DC Jewelry Trio Spark Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `473` |
| P177 | DC Jewelry butterfly adjustable ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `474` |
| P178 | DC Jewelry stone band ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `475` |
| P179 | DC Jewelry double rose adjustable ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `476` |
| P180 | DC Jewelry emerald cut adjustable ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `477` |
| P181 | DC Jewelry geometric flower adjustable ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `478` |
| P182 | Infinity Crossover CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `479` |
| P183 | Baguette Solitaire CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `481` |
| P184 | Pavé CZ Gold-Plated Band Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `482` |
| P185 | Princess Bar CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `483` |
| P186 | Rectangular Baguette CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `484` |
| P187 | Round Pavé CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `485` |
| P188 | Rectangle CZ Stone Gold-Plated Statement Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `486` |
| P189 | Leaf Marquise CZ Stone Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `487` |
| P190 | Dual Design Gold-Plated Adjustable Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `488` |
| P191 | Leaf Vine Design Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `489` |
| P192 | Interlocked Circle Knot Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `490` |
| P193 | Butterfly Design Dual Band Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `491` |
| P194 | Rose Gold Crystal Rope Bar Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `492` |
| P195 | Elegant Princess Cut Solitaire Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `493` |
| P196 | Teardrop CZ Gold-Plated Designer Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `494` |
| P197 | Cute Bow Knot CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `495` |
| P198 | Floral Halo Solitaire CZ Silver-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `496` |
| P199 | Heart Solitaire CZ Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `497` |
| P200 | Rose Gold-Plated Oval AD Solitaire Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `498` |
| P201 | Butterfly Circle CZ Gold-Plated Adjustable Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `499` |
| P202 | Rose Gold-Plated Floral Burst AD Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `500` |
| P203 | Gold-Plated Adjustable AD Knot Design Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `501` |
| P205 | Minimal Rose Gold Floral & Star Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `503` |
| P206 | Rose Gold-Plated Adjustable AD Criss-Cross Band Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `504` |
| P207 | Dome Pavé CZ Gold-Plated Ring | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `505` |
| P208 | Elegant Adjustable Floral Gold-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `507` |
| P209 | Bow Knot Designer CZ Silver-Plated Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `508` |
| P210 | Anti Tarnish Rose Gold-Plated Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `509` |
| P211 | Anti Tarnish Rose Gold-Plated Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `510` |
| P214 | Red Rain Drop Glass Bangles (12 Piece) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `513` |
| P215 | Blue Rain Drop Glass Bangles (12 piece) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `514` |
| P216 | Pink Rain Drop Glass Bangles (12 Piece) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `515` |
| P217 | Green Rain Drop Glass Bangles (12 Piece) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `516` |
| P218 | Satrangi Sitare &#124; Multicolor Glitter Glass Bangle Set of 12 | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `517` |
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
| P229 | Anti-Tarnish Triple Band Adjustable Wave Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `530` |
| P230 | Anti Tarnish Solitaire Spark Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `531` |
| P231 | Anti Tarnish Infinity Glam Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `532` |
| P232 | Anti-Tarnish "Duo Gleam" Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `533` |
| P233 | Anti-Tarnish Stone-Studded Adjustable Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `534` |
| P234 | Anti-Tarnish V-Shape Chevron Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `535` |
| P235 | Anti Tarnish Twisted Solitaire Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `536` |
| P236 | Anti Tarnish Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `537` |
| P237 | Anti-Tarnish Linked Infinity Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `538` |
| P238 | Anti-Tarnish Twin Wave Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `539` |
| P239 | Anti-Tarnish Infinity Wave Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `540` |
| P240 | Infinity Adjustable Silver Ring for Women | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `541` |
| P242 | Anti Tarnish Kada Bracelet Black & White | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `627` |
| P243 | Anti Tarnish Kada Bracelet Blue & Green | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `628` |
| P244 | Anti Tarnish Kada Bracelet red & amber orange | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `629` |
| P245 | White & Turquoise Raised Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `630` |
| P246 | Anti Tarnish Kada Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `631` |
| P247 | Anti-Tarnish Blue Ombre Enamel Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `632` |
| P248 | Anti-Tarnish Pink Enamel Ombre Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `633` |
| P249 | Anti-Tarnish Neutral Enamel Ombre Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `634` |
| P250 | Anti-Tarnish Multi-Color Bamboo Style Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `636` |
| P251 | Anti-Tarnish Blue Ombre Textured Enamel Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `637` |
| P252 | Anti-Tarnish Multi-Color Textured Enamel Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `638` |
| P253 | Anti-Tarnish Orange Floral Enamel Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `639` |
| P254 | Anti-Tarnish Yellow Bamboo Style Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `640` |
| P255 | Anti-Tarnish Pink Bamboo Style Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `641` |
| P256 | Anti-Tarnish Green Ombre Enamel Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `642` |
| P257 | Anti-Tarnish Minimalist Gold Plated Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `643` |
| P258 | Anti-Tarnish Blue Wave Enamel Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `644` |
| P259 | Anti-Tarnish Blue Striped Pearl Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `645` |
| P260 | Anti-Tarnish Yellow Enamel Pearl Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `646` |
| P261 | Anti-Tarnish Seafoam Bamboo Style Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `647` |
| P262 | Anti-Tarnish Multi-Color Bamboo Style Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `648` |
| P263 | Anti-Tarnish Pastel Chevron Enamel Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `649` |
| P264 | Anti-Tarnish Blue Diamond Pattern Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `650` |
| P265 | Anti-Tarnish Pink Leaf Pattern Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `651` |
| P266 | Anti-Tarnish Peach Bamboo Style Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `652` |
| P267 | Anti-Tarnish Pink Diamond Pattern Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `653` |
| P268 | Anti-Tarnish Pink Diamond Pattern Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `654` |
| P269 | Anti-Tarnish Pink Floral Enamel Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `655` |
| P270 | Anti-Tarnish Pink Bamboo Style Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `656` |
| P271 | Multi-Color Enamel Anti-Tarnish Designer Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `657` |
| P272 | Elegant Green Enamel Anti-Tarnish Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `658` |
| P273 | Anti-Tarnish Maroon Chevron Enamel Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `659` |
| P274 | Anti-Tarnish Red & White Modernist Enamel Kada | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `660` |
| P275 | Anti-Tarnish Monochrome Block Enamel Kada | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `661` |
| P276 | Anti-Tarnish Black Greek Key Kada | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `662` |
| P277 | Anti-Tarnish Minimalist Gold Loop Kada | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `663` |
| P278 | Anti-Tarnish Black Marble Enamel Kada | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `664` |
| P280 | Spiral Crystal Kangan (2 piece) | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `668` |
| P281 | Elegant Crystal Kangan (2 piece) | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `669` |
| P283 | Plain Crystal Kangan (2 piece) | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `671` |
| P284 | Elephant Crystal Kangan (2 piece) | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `672` |
| P285 | Light Golden Transparent Glass Bangles | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `677` |
| P286 | Transparent Golden Glass Stone Bangles | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `678` |
| P287 | Olive Green Glass Stone Bangles | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `679` |
| P288 | Dual-Tone Glass Stone Bangles | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `680` |
| P289 | Pastel Green Antique Glass Bangle Set | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `681` |
| P290 | Antique Multicolor Glass Bangles | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `682` |
| P291 | Golden Rose Heart Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `689` |
| P293 | Emerald Women's Round Pendant | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `692` |
| P294 | Cute Multi-Charm Necklace | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `695` |
| P296 | Starburst Flower Pendant Necklace - Anti-Tarnish Gold Jewelry | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `700` |
| P297 | Anti Tarnish Personalized Initial and Heart Necklace | `necklaces` | `priced-and-shot` | 2026-08-25 | batch `2026-08-23-batch-01`, Odoo id `701`. personalized left null — explicit "Personalized Initial" language but no initial-selection option in export; owner resolves mechanism. 2026-08-25: owner-instructed batch confirmation + pricing + image confirmation applied, but personalized left null by explicit owner instruction — validatePublishReadiness fails on D3 until the owner resolves the initial-selection mechanism; Phase 2 deliberately not run |
| P298 | Designer-Inspired Coin Pendant Necklace - Anti-Tarnish Gold Jewelry | `pendants` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `702` |
| P299 | Daisy Flower Pearl Pendant Necklace - Anti-Tarnish Gold Jewelry | `pendants` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `703` |
| P300 | Designer Charm Bracelet with Key and Lock - Anti-Tarnish Gold Jewelry | _(none)_ | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `708` |
| P301 | Gold-Plated Stainless Steel Fruit Charm Bracelet | _(none)_ | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `709` |
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
| P312 | Pink Rain Drop Glass Bangles (12 Piece) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `730` |
| P313 | Set of 12 Multicolor RainDrop Glass Bangles | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `731` |
| P314 | Set of 12 Colorful Festival RainDrop Glass Bangles | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `732` |
| P315 | Mint Green & White CZ Choker Necklace Set | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `737` |
| P316 | Green Kundan Pearl Choker Necklace Set | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `738` |
| P317 | Minimal Heart Necklace & Bracelet Set | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `739` |
| P318 | Gold-Plated Heart Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `740` |
| P319 | Pink CZ Tennis Necklace Set | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `741` |
| P320 | Gold-Plated Multicolor Drop Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `742` |
| P323 | Gold-Plated Pink Crystal Flower Stud Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `749` |
| P324 | Gold-Plated Mint Green Floral Stud Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `750` |
| P325 | Silver-Plated Blue & Crystal Floral Stud Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `751` |
| P326 | Silver-Plated Pink Drop Earrings with CZ Stones | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `752` |
| P327 | Multicolor Crystal Cluster Stud Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `753` |
| P328 | Korean Pink Square Adjustable Ring | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `754` |
| P329 | Black Stone Silver Ring | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `755` |
| P330 | Vintage Stone Silver Ring | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `756` |
| P331 | Red Stone Silver Ring | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `757` |
| P332 | Black Stone Silver Ring | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `758` |
| P333 | Green Stone Silver Ring | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `759` |
| P334 | Adjustable Gold-Plated Green Crystal Ring | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `764` |
| P335 | Trendy Fashion Rings for Women | `rings` _(extraction PROPOSAL — owner confirmation required)_ | `priced-and-shot` | 2026-08-25 | batch `2026-08-23-batch-01`, Odoo id `765`. 2026-08-25: owner-instructed batch confirmation + pricing + image confirmation applied, but reference price ₹10 sits below the catalogue hard floor (MIN_PRICE ₹25, price-band gate) and was flagged at extraction as a probable placeholder — Phase 2 held until the owner sets a real price |
| P336 | Trendy Fashion Rings for Women | `rings` _(extraction PROPOSAL — owner confirmation required)_ | `priced-and-shot` | 2026-08-25 | batch `2026-08-23-batch-01`, Odoo id `766`. 2026-08-25: owner-instructed batch confirmation + pricing + image confirmation applied, but reference price ₹10 below the ₹25 catalogue floor — Phase 2 held until the owner sets a real price |
| P337 | Trendy Fashion Rings for Women | `rings` _(extraction PROPOSAL — owner confirmation required)_ | `priced-and-shot` | 2026-08-25 | batch `2026-08-23-batch-01`, Odoo id `767`. 2026-08-25: owner-instructed batch confirmation + pricing + image confirmation applied, but reference price ₹10 below the ₹25 catalogue floor — Phase 2 held until the owner sets a real price |
| P338 | Elegant Rose gold Rings Set of 12 | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `768` |
| P339 | Raindrop Green Glass Bangles | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `773` |
| P340 | Set of 12 Multicolor Glass Bangles | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `774` |
| P341 | Royal Blue Glass Bangles Set of 12 with Golden Dotted Work | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `775` |
| P342 | Gold-Tone Glass Bangles Set of 12 with Crystal Dotted Work | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `776` |
| P343 | Emerald Green Glass Bangles Set of 12 with Golden Dotted Work | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `777` |
| P344 | Navy Blue Glass Bangles Set of 12 with Golden Dotted Work | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `778` |
| P345 | Transparent Glass Bangles Set of 12 with Golden Dotted Work | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `779` |
| P346 | Lime Green Glass Bangles Set of 12 with Crystal Dotted Work | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `780` |
| P347 | Set of 12 Olive Green Glass Bangles with Gold Bead Detailing | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `781` |
| P348 | Rust Orange Glass Bangles – Set of 12 with Gold Bead Accents | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `782` |
| P349 | Hot Pink Glass Bangles – Set of 12 with Gold Bead Detailing | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `783` |
| P350 | Ivory White Glass Bangles – Set of 12 with Gold Bead Detailing | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `784` |
| P351 | Royal Purple Glass Bangles – Set of 12 with Gold Bead Detailing | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `785` |
| P352 | Mustard Yellow Glass Bangles – Set of 12 with Gold Bead Detailing | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `786` |
| P353 | Anti Tarnish Elara Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `788` |
| P355 | Double Stone Adjustable Ring for Girls | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `790` |
| P356 | Minimal Thin Band Gold Ring for Girls | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `792` |
| P357 | Minimal Thin Band Gold Ring for Girls | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `793` |
| P358 | Minimal Solitaire Pendant Necklace for Women | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `794` |
| P359 | kashmiri ghungroo bangles | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `795` |
| P361 | Elegant Silver Knot Adjustable Ring for Women & Girls | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `801` |
| P362 | Gold Hug Hands Adjustable Ring for Women & Girls | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `802` |
| P364 | Minimal Pink Heart Chain Bracelet for Women & Girls | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `804` |
| P365 | Infinity Necklace Bracelet Ring Set | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `805` |
| P366 | Anti Tarnish Multicolor Adjustable Finger Ring For Women | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `807` |
| P367 | Trending Gold Plated Set of 3 Stackable Finger Rings | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `808` |
| P368 | Gold Plated Contemporary Stackable Rings Set of 11 | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `809` |
| P369 | Gold-Plated Anti Tarnish Green Geometric Pendant | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `811` |
| P370 | Gold Plated Anti Tarnish Nail Bracelet For Women | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `813` |
| P371 | Floating Teardrop Locket (Without Charm) | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `817`. **sourceNotes.rawContent:** accepted as a knownStub with 40 characters — extraction will have nothing to quote, so this one needs owner-supplied copy before Draft A |
| P382 | Infinity Gold-plated Stainless Steel Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `830` |
| P383 | Hollow-out Heart Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `831` |
| P384 | Infinity Gold-Plated Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `832` |
| P386 | Kashmiri Green Meenakari Floral Kundan Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `835` |
| P387 | Kashmiri Kundan Square Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `836` |
| P388 | Kashmiri Red Meenakari Tulip Kundan Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `837` |
| P389 | Kashmiri Red Tulip Kundan Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `839` |
| P390 | Kashmiri Yellow Lotus Elephant Meenakari Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `840` |
| P391 | Kashmiri Blue Meenakari Kundan Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `841` |
| P392 | Kashmiri dark Green Meenakari CZ Square Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `842` |
| P393 | Kashmiri Pink Meenakari Square Kundan CZ Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `844` |
| P394 | Stainless Steel Birthday Synthetic Zirconia Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `846` |
| P398 | 1pc Women'S Stainless Steel Zirconia Birthstone Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `850` |
| P399 | Minimalist Glossy Stainless Steel Infinity Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `851` |
| P400 | Minimalist Stainless Steel Ring with Green Crystal Stone | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `852` |
| P401 | Minimalist Stainless Steel Ring with White Crystal Stone | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `853` |
| P402 | Minimalist Stainless Steel Ring with White Crystal Red | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `854` |
| P403 | Minimalist Stainless Steel Ring with White Crystal Pink | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `855` |
| P404 | Pink Petal Cherry Blossom Spring Pendant Necklace for Women | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `856` |
| P405 | Minimalist Vintage Square Synthetic Gemstone Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `857` |
| P406 | Minimalist Vintage Square Synthetic Gemstone Ring | `rings` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `858` |
| P407 | Brass Initial Letter adjustable ring | _(none)_ | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `860` |
| P408 | Brass Initial Letter adjustable ring (Silver) | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `861` |
| P409 | Set of 8 Viral Jelly Bangle (Mint Tint) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `862` |
| P410 | Set of 8 Viral Jelly Bangle (Hot Pink) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `863` |
| P411 | Set of 8 Viral Jelly Bangle (Smoke Grey) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `864` |
| P412 | Set of 8 Viral Jelly Bangle (Ruby Red) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `865` |
| P413 | Set of 8 Viral Jelly Bangle (Ocean) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `866` |
| P414 | Set of 8 Viral Jelly Bangle (Light Multi) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `867` |
| P415 | Set of 8 Viral Jelly Bangle (Crystal Clear) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `868` |
| P416 | Set of 8 Viral Jelly Bangle (Dark Multi) | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `869` |
| P417 | Set of 8 Viral Jelly Bangle (Blush Pink) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `870` |
| P418 | Set of 8 Viral Jelly Bangle (Rose Pink) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `871` |
| P419 | Set of 8 Viral Jelly Bangle (Peach) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `872` |
| P420 | Set of 8 Viral Jelly Bangle (Pistachio Tint) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `873` |
| P421 | Set of 8 Viral Jelly Bangle (Caramel Tint) | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `874` |
| P422 | Dainty Sparkling Butterfly Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `875` |
| P423 | Layered Geometric Necklace – Gold | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `876` |
| P424 | Star Pendant Necklace in Gold Finish | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `877` |
| P425 | Dainty Gold Bow Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `878` |
| P426 | Gold Bow Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `879` |
| P427 | Elegant Gold Snake Chain Bow Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `880` |
| P428 | Gold Beaded Chain Bow Necklace | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `881` |
| P429 | Textured Gold Bow Pendant Necklace | `pendants` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `882` |
| P430 | Pearl Station Necklace in Gold | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `883` |
| P431 | Heart Lariat Necklace | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `884` |
| P432 | Gold Bow Jewelry Set | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `885` |
| P433 | Puffed Heart Necklace on Sleek Snake Chain | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `886` |
| P434 | Mother of Pearl Heart Necklace in Gold | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `887` |
| P435 | Elongated Heart Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `888` |
| P436 | Vintage-Style Filigree Heart Pendant on Chunky Rope Chain | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `889` |
| P437 | Fan-Shaped Crystal Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `891` |
| P438 | Silver Evil Eye Bracelet with Sparkling Crystals | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `892` |
| P439 | Sparkling Silver Anchor & Evil Eye Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `893` |
| P440 | Silver Ship Wheel Evil Eye Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `894` |
| P441 | Silver Butterfly Evil Eye Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `895` |
| P442 | Silver Tree of Life Evil Eye Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `896` |
| P443 | Sparkling Silver Eyelash Evil Eye Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `897` |
| P444 | Silver Teardrop Evil Eye Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `898` |
| P445 | Classic Silver Round Evil Eye Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `899` |
| P446 | Minimalist Silver Round Evil Eye Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `900` |
| P448 | Sparkling Silver Tennis Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `904` |
| P450 | Heart Charm Gold Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `906` |
| P451 | Gold Heartbeat Lifeline Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `907` |
| P452 | Gold Winged Heart Lock Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `908` |
| P453 | Stylish "Love" Script Gold Bracelet | _(none)_ | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `909` |
| P454 | Gold Interlocking Double Heart Bracelet | _(none)_ | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `910` |
| P455 | Elegant Heart Charm Gold Bracelet | _(none)_ | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `911` |
| P456 | Elegant Rose Gold Tennis Bracelet | _(none)_ | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `912` |
| P457 | Elegant Rose Gold Tennis Bracelet Sparkling Marquise Crystal | _(none)_ | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `913` |
| P458 | Gold Love Heart Bracelet | _(none)_ | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `914` |
| P459 | Gold Infinity Heart Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `915` |
| P460 | Gold Eiffel Tower Charm Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `916` |
| P461 | Gold Treble Clef Music Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `917` |
| P462 | Gold Heartbeat Lifeline Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `918` |
| P463 | Gold Bracelet Combo Set – Delicate Heart Link Chain & Minimalist Pearl Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `919` |
| P464 | Gold Chain Bracelet Combo – Elegant Rope & Paperclip Link Set | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `920` |
| P465 | Gold Dainty Bracelet Combo Set – Minimalist Pearl Strand & Textured Link Chain | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `921` |
| P466 | old Dainty Bracelet Combo Set – Minimalist Ball Chain & Shimmering Twisted Link Duo | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `922` |
| P467 | Gold Dainty Bracelet Combo Set – Minimalist Link Chain & Elegant Leaf Motif Duo | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `923` |
| P468 | Gold Paperclip & Heart Chain Bracelet Combo | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `924` |
| P469 | Gold Dainty Bracelet Combo Set – Minimalist Beaded Twisted Chain & Sleek Box Chain | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `925` |
| P470 | Gold Dainty Bracelet Combo Set – Minimalist Ball Chain & Beaded Link Duo | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `926` |
| P471 | Gold Chain Bracelet Combo – Elegant Rope & Box Link Set | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `927` |
| P472 | Gold Bracelet Combo Set – Sparkling Crystal Tennis Bracelet & Sleek Snake Chain | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `928` |
| P473 | Gold Chain Bracelet Combo Set – Sleek Snake Chain & Classic Figaro Link | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `929` |
| P474 | Sparkling Silver-Toned Tennis Bracelet | _(none)_ | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `930` |
| P476 | Gold- Plated Traditional Nath – Vibrant Ruby & Emerald Green Stone Studded | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `932` |
| P477 | Gold-Plated Minimalist Nath – Sparkling White Stone Studded | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `933` |
| P479 | Silver-Plated Designer Nath – Sparkling White Zirconia Studded | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `935` |
| P480 | Gold-Plated Dainty Nath – Sparkling White Stone Studded | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `936` |
| P481 | Silver-Plated Baguette Stone Nath – Sparkling White Zirconia | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `937` |
| P482 | Gold-Plated Floral Cluster Nath – Sparkling White Stone Studded | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `938` |
| P483 | Gold-Plated Traditional Nath – Ruby Red & White Stone Studded | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `939` |
| P484 | Gold-Plated Traditional White Stone Nath – Sparkling Nose Ring with Pearl Drop | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `940` |
| P485 | Gold-Plated Floral Teardrop Nath – Sparkling White Stone Studded | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `941` |
| P486 | Gold-Plated Multi-Stone Traditional Nath – Vibrant Ruby, Emerald & White Stone | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `942` |
| P487 | Gold-Plated Multi-Color Stone Traditional Nath – Vibrant Ruby & Emerald Green | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `943` |
| P488 | Silver-Plated Dainty White Stone Nath – Sparkling CZ Studded with Teardrop Drop | `nose-pins` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `944` |
| P489 | Silver-Plated Floral Cluster Nath – Sparkling White Zirconia Studded | `nose-pins` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `945` |
| P490 | Gold-Plated Minimalist Stone Nath – Sparkling Dainty with Teardrop Charm | `nose-pins` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `946` |
| P491 | Gold-Plated Traditional Peacock Nath – Shimmering White Stone with Pearl Drop | `nose-pins` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `947` |
| P492 | Gold-Plated Traditional Peacock Nath – Sparkling Ruby Red & White Stone with Pearl Drop | `nose-pins` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `948` |
| P493 | Silver-Plated Floral Teardrop Nath – Sparkling White Stone Studded | `nose-pins` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `949` |
| P494 | Stainless Steel Textured Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `950` |
| P495 | Stainless Steel Engraved Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `951` |
| P496 | Stainless Steel Swirl Texture Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `952` |
| P497 | Stainless Steel Bamboo Style Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `953` |
| P498 | Stainless Steel Embossed Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `954` |
| P499 | Vibrant Pink Glass Bangle Set with Golden Ghoonghroo Accents – 16-Piece | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `955` |
| P500 | Elegant Lavender Glass Bangle Set with Golden Ghoonghroo Accents – 16-Piece | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `956` |
| P501 | Refreshing Sage Green Glass Bangle Set with Golden Ghoonghroo Accents – 16-Piece | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `957` |
| P502 | Deep Purple Glass Bangle Set with Golden Ghoonghroo Accents – 16-Piece | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `958` |
| P503 | Royal Maroon Glass Bangle Set with Golden Ghoonghroo Accents – 16-Piece | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `959` |
| P504 | Classic Grey Glass Bangle Set with Golden Ghoonghroo Accents – 16-Piece | `bangles` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `960` |
| P505 | Vibrant Emerald Green Glass Bangle Set with Golden Ghoonghroo Accents – 16-Piece | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `961` |
| P506 | Royal Purple Glass Bangle Set with Golden Ghoonghroo Accents – 16-Piece | `bangles` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `962` |
| P507 | Flower Leaf Design Shiny Colorful Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `968` |
| P508 | Red Luo Shen Flower Necklace with Earrings | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `969` |
| P509 | Emerald Green Floral Anti-Tarnish Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `970` |
| P510 | Blush Pink Floral Anti-Tarnish Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `971` |
| P511 | Aqua Blue Floral Anti-Tarnish Kada | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `972` |
| P512 | Blush pink Crystal Tulip Pendant | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `973` |
| P513 | Gold Heart Locket Adjustable Open Ring | `rings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `974` |
| P514 | Gold Heart Locket Personalized Necklace | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `976` |
| P515 | Gold Oval Locket Personalized Necklace | `necklaces` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `977` |
| P516 | Elegant Red Rose Gold Stem Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `978` |
| P517 | Purple Enamel Floral Gold Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `979` |
| P518 | White Enamel Magnolia Flower Gold Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `980` |
| P519 | Gold Crystal Floral Vine Cluster Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `981` |
| P520 | Gold Emerald Crystal Leaf Vine Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `982` |
| P521 | Luxurious  Fairy Bloom Floral Tulip Bracelet With Red Green Stones | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `983` |
| P522 | Colorful Zirconia Leaf Jewelry Set | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `984` |
| P523 | Baroque Pearl Tulip Toggle Clasp Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `985` |
| P524 | Yellow Zirconia Tulip Gold Clavicle Chain | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `986` |
| P525 | Red Zirconia Tulip Gold Clavicle Chain | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `987` |
| P526 | Gold Tulip Cat's Eye Pull Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `988` |
| P527 | Vibrant Pink Enamel Tulip Gold Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `989` |
| P528 | Soft Rose Enamel Tulip Floral Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `990` |
| P529 | Pink Enamel Tulip Gold Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `991` |
| P530 | Red Enamel Tulip Gold Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `992` |
| P531 | The Cutest Pinterest-y Birthday Hamper 🎀 | `gift-hampers` | `priced-and-shot` | 2026-08-25 | batch `2026-08-23-batch-01`, Odoo id `994`. personalized left null (Initial Letter Ring in contents, no letter option); COD-restriction notice stripped as boilerplate but flagged as a possibly real payment constraint. 2026-08-25: owner-instructed batch confirmation + pricing + image confirmation applied, but personalized left null by explicit owner instruction (Initial Letter Ring, no letter option) — readiness fails on D3; Phase 2 deliberately not run |
| P532 | Pinteresty Birthday Hamper 🎀 | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `995` |
| P534 | Eid Mubarak Gift Hamper | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `998` |
| P535 | Couple Birthday Hamper - Silver Edition | `gift-hampers` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `999` |
| P536 | Couple Birthday Hamper - Gold Edition | `gift-hampers` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1000` |
| P537 | Luxury Birthday Jewellery Hamper | `gift-hampers` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1001` |
| P538 | Premium Eid Mubarak Hamper | `gift-hampers` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1002` |
| P539 | Pastel Flower Anti Tarnish Floral Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1005` |
| P540 | Rose Vine Anti Tarnish tulip Bracelet for Women | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1006` |
| P541 | Purple Floral Bow Anti Tarnish Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1007` |
| P542 | Anti Tarnish Tulip Crystal Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1008` |
| P543 | Emerald Vine Anti Tarnish Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1009` |
| P544 | Blush Crystal Vine Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1010` |
| P545 | Birthday Hamper for Her | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1011` |
| P546 | Pink Blossom Bow Bracelet for Women | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1012` |
| P547 | Purple Blossom Bow Bracelet for Women | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1013` |
| P548 | White Blossom Bow Bracelet for Women | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1014` |
| P549 | Anti Tarnish Gold Wheat Chain Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1015` |
| P550 | Anti Tarnish Gold Ball Charm Bracelet for Women | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1016` |
| P551 | Anti Tarnish Gold CZ Tennis Bracelet for Women | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1017` |
| P552 | Anti Tarnish Gold CZ Tennis Bracelet with Square Solitaire Stone | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1018` |
| P553 | Anti Tarnish Gold Bead Bracelet with CZ Square Stone for Women | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1019` |
| P554 | Anti Tarnish Gold Double Layer Snake Chain Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1020` |
| P555 | Anti Tarnish Pink tulip Leaf CZ Bracelet | `bracelets` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1021` |
| P556 | Anti Tarnish Dainty Gold CZ Tennis Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1022` |
| P557 | Kashmiri Lotus Kundan Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1023` |
| P558 | Kashmiri Meenakari Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1024` |
| P559 | Kashmiri Green Meenakari Kundan Pearl Mandala Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1026` |
| P560 | Blue Tulip Anti-Tarnish Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1029` |
| P561 | Pink Tulip Anti-Tarnish Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1030` |
| P562 | Multicolour Tulip Anti-Tarnish Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1031` |
| P563 | Pink Flower Anti-Tarnish Bracelet | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1032` |
| P564 | Red Ruby & Emerald Vine Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1033` |
| P565 | Purple & Emerald CZ Gold-Plated Anti-Tarnish Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1034` |
| P566 | Crystal White CZ Gold-Plated Anti-Tarnish Vine Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1035` |
| P567 | Pink Rose & Emerald CZ Gold-Plated Anti-Tarnish Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1036` |
| P568 | Amethyst Purple & Emerald CZ Gold-Plated Anti-Tarnish Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1037` |
| P569 | Pink & Purple Marquise Leaf Jewellery Set | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1038` |
| P570 | Diamond Petal Fringe Gold Stainless Steel Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1040` |
| P571 | Spiral Textured Chunky Gold-Plated Anti-Tarnish Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1041` |
| P572 | Spiral Texture Gold Stainless Steel Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1042` |
| P573 | Cross Hatch Gold Stainless Steel Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1043` |
| P574 | Twisted Rope Heart Gold Stainless Steel Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1044` |
| P575 | Crescent Moon Cutout Gold Stainless Steel Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1045` |
| P576 | Croissant Ribbed Gold Stainless Steel C-Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1046` |
| P577 | Quilted Grid Gold Stainless Steel Hoop Earrings | `earrings` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1047` |
| P578 | Black Evil Eye Spiral Charm Anklet – Set of 2 | `anklets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1048` |
| P579 | Clover Charm Gold Anti-Tarnish Anklet | `anklets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1049` |
| P581 | Silver Snake Chain Ball Anklet – Set of 2 | `anklets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1051` |
| P582 | Orange Enamel Floral Kada – Gold Plated Anti-Tarnish | `bracelets` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1052` |
| P583 | Pink Tulip Bow Hair Clip | `hair-accessories` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1053` |
| P584 | Satin Rose Flower Hair Tie – Set of 2 | `hair-accessories` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1054` |
| P585 | Satin Rose Flower Hair Tie – Black & White Set of 2 | `hair-accessories` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1055` |
| P587 | Satin Long Tail Bow Hair Clip | `hair-accessories` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1057` |
| P588 | Satin Scrunchies Set of 4 | `hair-accessories` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1058` |
| P589 | Satin Scrunchies Set of 4 | `hair-accessories` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1059` |
| P590 | Layered Satin Bow Hair Clip | `hair-accessories` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1060` |
| P591 | Tulip Bow Hair Clip | `hair-accessories` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1061` |
| P592 | Satin Scrunchie & Chocolate Hamper for Her | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1062` |
| P593 | Luxury Jewellery Gift Hamper for Her | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1063` |
| P594 | Forever Friends Hamper | `gift-hampers` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1064` |
| P595 | Happy Friendship Day Hamper | `gift-hampers` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1065` |
| P596 | Best Friends Forever Hamper | `gift-hampers` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1066` |
| P597 | Self Care Gift Hamper for Her | `gift-hampers` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1067` |
| P598 | Birthday Decorated Jewelry Hamper for her | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1068` |
| P599 | Deluxe Jewelry Gift Hamper for her | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1069` |
| P600 | Luxury Raksha Bandhan Gift Hamper | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1070` |
| P601 | Traditional Rajasthani Pearl Beaded Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1071` |
| P602 | Traditional Antique Gold Kundan Bracelet Watch for Women &#124; | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1072` |
| P603 | Traditional Kundan Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1073` |
| P604 | Red Meenakari Gold Plated Ethnic Wrist Watch with Ghungroo | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1075` |
| P605 | Green Meenakari Gold Plated Ethnic Wrist Watch with Ghungroo | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1076` |
| P607 | Luxury Silver Crystal Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1079` |
| P609 | Vintage Anti-Tarnish Silver Blue Dial Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1081` |
| P610 | Vintage Anti-Tarnish Gold Red Dial Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1082` |
| P611 | Vintage Anti-Tarnish Gold Green Dial Pearl Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1083` |
| P612 | Vintage Anti-Tarnish Gold Green Dial Chain Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1084` |
| P613 | Vintage Anti-Tarnish Gold Green Dial Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1085` |
| P614 | Vintage Anti-Tarnish Gold Green Dial Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1086` |
| P615 | Vintage Anti-Tarnish Gold White Dial Crystal Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1087` |
| P616 | Vintage Anti-Tarnish Silver Blue Dial Mesh Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1088` |
| P617 | Vintage Anti-Tarnish Gold White Dial Pearl Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1089` |
| P618 | Vintage Anti-Tarnish Gold Beaded Bracelet Watch for Women | `watches` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1090` |
| P619 | Vintage Anti-Tarnish Gold Green Dial Beaded Bracelet Watch for Women | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1091` |
| P620 | Vintage Anti-Tarnish Gold Red Dial Bracelet Watch for Women | `watches` | `queued` | 2026-08-24 | batch `2026-08-23-batch-01`, Odoo id `1092` |
| P621 | Vintage Gold Green Square Dial Mesh Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1093` |
| P622 | Vintage Anti-Tarnish Gold Emerald Green Dial Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1094` |
| P623 | Vintage Anti-Tarnish Gold Oval Link Emerald Dial Bracelet Watch | `watches` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1095` |
| P624 | Classic Mystery Jewellery Jar ✨ | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1096` |
| P625 | Surprise Mystery Jewellery Jar | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1097` |
| P626 | Premium Mystery Jewellery Jar | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1098` |
| P627 | Ultra Premium Mystery Jewellery Jar | `gift-hampers` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1099` |
| P628 | A Letter Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1100` |
| P629 | Aqua Blue Heart Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1101` |
| P630 | Gold Heart Wreath Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1102` |
| P631 | Green Heart Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1103` |
| P632 | Emerald Green Baguette Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1104` |
| P633 | Emerald Green Stone Necklace | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1105` |
| P634 | White Crystal Heart Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1106` |
| P635 | Sunburst Key Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1107` |
| P636 | Birthstone Purple Bar Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1108` |
| P637 | Purple Enamel Flower Pendant Necklace | `pendants` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1109` |
| P638 | Vintage-Style Amethyst Necklace with Crystal Leaf Halo | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1110` |
| P639 | Gold Tulip Necklace with Ruby | `necklaces` | `extracted` | 2026-08-27 | batch `2026-08-23-batch-01`, Odoo id `1111` |
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
