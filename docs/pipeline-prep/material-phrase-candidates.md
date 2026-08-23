# Material / plating / stone phrase candidates

Source: `Latest.xlsx`, sheet `Sheet1`, single column **eCommerce Description**.
Generated as raw extraction input, originally for an owner-built `data/material-phrases.json`.
**That file was never built and is no longer planned** — [ADR-051's addendum](../decisions/ADR-051-draft-a-content-pipeline.md#addendum-2026-08-23--the-validator-exists-and-the-allow-list-gate-does-not)
retired the allow-list gate, so this table is reference material and is read by nothing.

> **This is a candidate list, not an allow-list.** Nothing in this table has been judged
> for honesty-policy compliance, accuracy, or whether two phrases mean the same thing.
> No phrase here has been approved for use in a listing. Every grouping below is exact
> string equality only — no fuzzy matching, no semantic merging, no normalisation.
> The category column is a **literal keyword guess and is unverified**.

## Summary

| | |
| --- | --- |
| Data rows in the file (excluding the header) | 544 |
| Rows set aside as non-product (see `non-product-rows.md`) | 52 |
| Product-description rows scanned | 492 |
| Phrase occurrences captured | 2065 |
| Distinct phrases (exact string match) | 531 |
| Rows with at least one captured phrase | 461 |
| Rows with no captured phrase (silence, not absence of a claim to be inferred) | 31 |

Row numbers throughout are **spreadsheet row numbers** — the header is row 1, so the
first description is row 2.

## How to read this table

- **Phrase** — captured verbatim from the cleaned text, including its original capitalisation.
  `Gold-Plated`, `gold-plated` and `gold plating` are three separate rows because they are
  three different strings. Deciding whether they mean the same thing is the owner's call.
- **Category guess** — produced by asking only "does this string contain a word from the
  material list / the plating list / the stone list". A phrase that hits two lists shows both.
  It is not a judgement about what the phrase claims.
- **Example** — a ~150-character window of the cleaned source text around the first
  occurrence, so the phrase can be seen in context rather than at the start of the row.
- **Rows** — every spreadsheet row the phrase appears in, capped at 15 with a count of the rest.

## Extraction rule (so the boundaries of each phrase are auditable)

A phrase is the longest unbroken run of words that contains at least one **anchor word**
and is otherwise made only of anchor words and **joining words**.

- Anchor words — material: `alloy, stainless, steel, brass, copper, sterling, silver, gold,
  golden, titanium, zinc, resin, acrylic, glass, enamel, rhodium, platinum, pewter, ceramic,
  iron, wood(en), leather, shell, seashell, cowrie, fabric, velvet, metal(s)`; plating:
  `plated, plating, plate, tone(s), toned, finish(ed/es), coated, coating, vermeil,
  electroplated, dipped, filled`; stone: `zircon(s), zirconia, cz, crystal(s), rhinestone(s),
  diamond(s), amethyst, moissanite, opal(s), pearl(s), pearlescent, turquoise, jade, ruby,
  rubies, emerald(s), sapphire(s), quartz, garnet, topaz, agate, moonstone, gemstone(s),
  stone(s), onyx, citrine, peridot, aquamarine, tourmaline, malachite, obsidian, jasper,
  hematite, marcasite, kundan, polki, navratna, coral`.
- Joining words — quality and treatment claims (`quality, high-quality, premium, genuine,
  real, natural, synthetic, simulated, imitation, faux, artificial, pure, solid, durable,
  sturdy, anti-tarnish, tarnish-resistant, rust-proof, water-resistant, skin-safe,
  hypoallergenic, nickel-free, lead-free, polished, oxidised, antique, matte, glossy, …`),
  grade codes (`18K, 14K, 925, 316L, …`), colours, cut words (`cubic, marquise, solitaire,
  baguette-cut, …`) and origin words (`American, Austrian, Czech, Swarovski, Korean, …`).
- A run stops at any other word and at any punctuation, bullet, emoji or line break.
- A spec label immediately followed by a colon (`Material:`, `Plating:`, `Stone Type:`,
  `Stones:`, `Finish:`, `Colour:`) is removed, so the label never becomes part of the value.
- **Purely aesthetic adjectives are not joining words** — `sparkling`, `brilliant`,
  `shimmering`, `radiant`, `delicate`, `dazzling`, `elegant`, `luxurious`, `rich` and the
  like end a run rather than extend it. This is the one place where the phrase boundary is
  a lexical choice rather than the raw text, and it is stated here so it can be overruled.

## Candidate phrases

| Phrase | Category guess (unverified) | Count | Example source row (cleaned, ~150 chars) | Rows |
| --- | --- | --- | --- | --- |
| `golden` | material | 91 | …ethnic look with this royal blue glass bangle set adorned with delicate golden polka-dot detailing . Crafted from premium-quality glass, these bangles… | 85, 97, 126, 158, 159, 162, 163, 181, 184, 192, 195, 200, 211, 212, 213, … (+48 more) |
| `gold` | material | 84 | A beautifully sculpted red rose in full bloom, complete with a curved gold stem and delicate leaves, capturing the romance of a single rose in miniatu… | 4, 8, 9, 12, 13, 17, 23, 37, 73, 74, 75, 79, 80, 82, 87, … (+48 more) |
| `finish` | plating | 68 | …e is perfect for everyday luxury. Its sleek, modern design ensures a bold statement that maintains its brilliant luster and striking finish over time. | 31, 41, 48, 68, 74, 108, 172, 173, 176, 185, 187, 200, 204, 208, 242, … (+45 more) |
| `gold-plated` | material + plating | 41 | Bring a fresh pop of color to your look with this adjustable gold-plated ring, adorned with a radiant green rectangular crystal. Its minimalist solita… | 7, 8, 45, 47, 48, 67, 86, 90, 93, 96, 107, 111, 112, 113, 170, … (+25 more) |
| `gold-toned` | material + plating | 40 | A rich, gold-toned gift hamper that brings together elegant everyday jewellery with indulgent chocolate treats. Packed in a signature pink gift box wi… | 80, 159, 166, 186, 210, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, … (+25 more) |
| `crystal` | stone | 39 | … adjustable gold-plated ring, adorned with a radiant green rectangular crystal. Its minimalist solitaire design makes it perfect for everyday wear, pa… | 7, 40, 83, 99, 101, 164, 218, 223, 231, 240, 252, 256, 271, 322, 327, … (+16 more) |
| `stones` | stone | 36 | … & Emerald Vine Anti-Tarnish Necklace features rich deep purple oval CZ stones set against vibrant emerald green leaf accents on a gold-plated V-vine … | 8, 9, 25, 27, 39, 43, 65, 66, 73, 94, 164, 173, 177, 180, 189, … (+17 more) |
| `Brass` | material | 35 | … & perfume Images may appear brighter than the actual product due to photographic effect. Toggle Clasp Brass Package contains: 1 bracelet Color Golden | 20, 24, 115, 116, 117, 118, 119, 121, 122, 123, 124, 125, 126, 127, 128, … (+20 more) |
| `CZ Gold-Plated` | material + plating + stone | 34 | Product Description: Embrace chic simplicity with the Bar & Pebble CZ Gold-Plated Minimalist Ring for Women . This contemporary open band features a s… | 77, 90, 93, 96, 112, 113, 170, 172, 202, 208, 278, 326, 337, 340, 361, … (+2 more) |
| `Stainless Steel` | material | 33 | …ht - 1.4gm Height - 1.8 cm Plating- 18k gold tone plated Material- Stainless Steel You will receive the ring in a box. As this is a handmade product i… | 10, 11, 18, 22, 25, 27, 28, 29, 37, 44, 45, 68, 69, 72, 114, … (+18 more) |
| `CZ stones` | stone | 32 | … quality alloy with a gold-plated finish, the band features brilliant CZ stones arranged in the iconic love message. The adjustable open band fits mos… | 2, 90, 93, 96, 107, 112, 113, 123, 148, 157, 171, 172, 202, 208, 278, … (+9 more) |
| `stone` | stone | 31 | …ttle treat for yourself. Details: Elegant initial “A” pendant Sparkling stone detailing Delicate gold-tone chain Perfect for everyday wear and gifting… | 6, 25, 41, 43, 65, 67, 100, 156, 175, 239, 257, 300, 317, 326, 331, … (+10 more) |
| `CZ` | stone | 30 | Effortlessly elegant — this ultra-slim CZ tennis bracelet sits beautifully on the wrist with a delicate row of sparkling stones in a sleek gold settin… | 9, 14, 15, 91, 112, 116, 118, 121, 128, 130, 132, 135, 139, 149, 170, … (+11 more) |
| `gold plating` | material + plating | 29 | …rom anti-tarnish stainless steel and beautifully finished in radiant gold plating, this ring features an elegant infinity twist band set with sparklin… | 18, 25, 27, 76, 90, 93, 107, 112, 113, 170, 172, 176, 185, 208, 273, … (+12 more) |
| `Premium American Diamonds` | stone | 29 | …Ring 🔹 Plating: Rosegold Polished 🔹 Material: Brass 🔹 Stones: Premium American Diamonds 🔹 Design: Star-shaped – a minimalist and chic addition to your… | 115, 116, 117, 118, 119, 121, 122, 124, 125, 127, 128, 129, 130, 131, 132, … (+14 more) |
| `pearl` | stone | 28 | …ent with this premium blue striped enamel kada featuring a bold central pearl. Expertly crafted with a high-quality gold finish, its anti-tarnish and … | 35, 71, 161, 209, 213, 222, 259, 260, 261, 262, 266, 289, 290, 291, 307, … (+7 more) |
| `glass` | material | 27 | …ion: Bring elegance to your ethnic look with these dual-tone multicolor glass bangles, beautifully studded with sparkling stones. Perfect for festival… | 177, 180, 184, 191, 209, 263, 302, 335, 358, 359, 379, 401, 408, 434, 456, … (+4 more) |
| `cubic zirconia` | stone | 26 | …ng features a brilliant round centerpiece stone flanked by dazzling cubic zirconia accents on the band. Its sturdy, non-adjustable fit and sophisticat… | 25, 77, 93, 96, 107, 113, 170, 171, 172, 179, 202, 208, 273, 278, 316, … (+9 more) |
| `18K gold-plated stainless steel` | material + plating | 24 | … as a statement or layered with simpler pieces. Crafted in 18K gold-plated stainless steel, it's tarnish and water resistant, so it stays beautiful wi… | 4, 82, 100, 193, 196, 227, 240, 265, 327, 366, 445, 486 |
| `emerald green` | stone | 23 | …cklace features rich deep purple oval CZ stones set against vibrant emerald green leaf accents on a gold-plated V-vine design. Regal, confident, and s… | 8, 86, 194, 195, 265, 332, 353, 363, 376, 404, 470, 471, 472, 475, 476 |
| `Gold` | material | 20 | …ing is ideal for daily wear, parties, or gifting someone special Colour- Gold Sizes Available: Size 6 → Diameter: 1.6 cm Size 7 → Diameter: 1.7 cm Siz… | 10, 11, 18, 25, 27, 44, 45, 68, 105, 158, 207, 212, 230, 264, 279, … (+5 more) |
| `18K Gold-Plated` | material + plating | 18 | …ium Quality \| Anti-Tarnish Base Material: Stainless Steel Plating: 18K Gold-Plated Shape: Initial and Heart Size: One-size & Adjustable Net Quantity: … | 22, 28, 29, 37, 114, 160, 161, 167, 168, 197, 199, 205, 321, 329, 442, … (+3 more) |
| `anti-tarnish coating` | plating | 18 | … gorgeous — this necklace commands attention. 💛 Gold-plated with anti-tarnish coating 💜 Deep amethyst purple oval CZ + emerald green leaf stones 🌿 V-s… | 8, 40, 43, 65, 66, 86, 101, 111, 174, 194, 332, 336, 344, 349, 353, … (+3 more) |
| `high-quality gold finish` | material + plating | 16 | …a featuring a classic Greek key motif. Expertly crafted with a high-quality gold finish, its anti-tarnish and water-resistant properties ensure long-l… | 30, 32, 34, 35, 36, 46, 49, 54, 55, 56, 57, 59, 61, 62, 63, … (+1 more) |
| `silver-toned` | material + plating | 16 | …his fashion-forward piece is perfect for daily layering. To maintain its brilliant silver-toned luster, keep it dry and store safely after every wear. | 99, 271, 322, 409, 411, 412, 414, 415, 418, 420, 421, 422, 423, 424, 430, … (+1 more) |
| `enamel` | material | 15 | Define sophistication with this premium black marble enamel kada, a Crafted with high-quality gold plating, this anti-tarnish and water-resistant piec… | 31, 35, 36, 43, 46, 49, 54, 55, 57, 61, 62, 63, 266 |
| `glossy finish` | plating | 15 | …r (Green, Yellow, Pink, Orange) Design: Stylish ethnic bangles with glossy finish Size/ Fit: Available in multiple sizes (2.4, 2.6, 2.8, etc.) Occasio… | 177, 195, 263, 301, 303, 334, 335, 389, 434, 456, 457, 461, 462, 463 |
| `premium-quality glass` | material | 15 | …o weddings, festivals, and special occasions . Handcrafted with premium-quality glass and embellished with fine stone detailing, each bangle exudes tr… | 73, 85, 162, 195, 263, 303, 334, 335, 339, 352, 389, 392, 456, 461, 462 |
| `Quartz` | stone | 15 | …zed polished beaded bracelet design 🔗 Unique statement bracelet strap ⌚ Quartz movement 💎 Watch + statement jewellery in one 👗 Perfect for ethnic and … | 469, 470, 471, 472, 473, 474, 475, 476, 477, 478, 479, 480, 481, 482, 483 |
| `Gold-Plated` | material + plating | 14 | …ry to elevate your everyday look. Material: Stainless Steel Plating: Gold-Plated Stone type: Not applicable Closure: Lobster closure Warranty: 1 month… | 166, 176, 244, 258, 279, 301, 342, 460, 488 |
| `Gold-plated` | material + plating | 14 | …ident, and strikingly gorgeous — this necklace commands attention. 💛 Gold-plated with anti-tarnish coating 💜 Deep amethyst purple oval CZ + emerald gr… | 8, 86, 101, 111, 174, 332, 336, 344, 349, 353, 354, 363, 376 |
| `durable alloy` | material | 13 | …oved ones Highlights / Specifications: 🔹 Material: Premium-quality, durable alloy 🔹 Plating: Handsome gold plating for lasting shine 🔹 Stone Type: Spa… | 76, 96, 112, 113, 170, 171, 172, 202, 282, 300, 301, 342, 361 |
| `high-quality glass` | material | 13 | …sy vibe. ✨ Material: Glass 💫 Quantity: 2 bangles (1 pair) Made of high-quality glass – delicate yet elegant Comes in a pair (2 kadas) Stylish design s… | 180, 268, 275, 283, 302, 333, 358, 393, 401, 404, 406, 434, 463 |
| `premium glass` | material | 13 | …ve for every jewelry lover. Key Features: Bold thick kada design in premium glass for a standout look Vibrant multicolor set: Green, white, amber, lav… | 191, 275, 283, 333, 351, 375, 392, 393, 403, 405, 406, 462, 463 |
| `white stones` | stone | 13 | … stunning gold-toned nath, featuring a delicate circle of shimmering white stones and a dainty teardrop charm. To maintain its radiant golden luster a… | 245, 246, 247, 248, 251, 254, 260, 262, 420, 421, 422, 424, 451 |
| `Anti-Tarnish Gold` | material | 12 | Make a bold yet elegant statement with this Vintage Anti-Tarnish Gold Bracelet Watch , featuring a sleek white oval dial and a unique bracelet made wi… | 469, 470, 471, 472, 473, 474, 475, 476, 477, 478, 479, 480 |
| `Anti-tarnish gold-tone finish` | material + plating | 12 | …sly. Product Highlights ✨ Vintage-inspired bracelet watch 💛 Anti-tarnish gold-tone finish 🤍 Elegant white oval dial 🟡 Oversized polished beaded bracel… | 469, 470, 471, 472, 473, 474, 475, 476, 477, 478, 479, 480 |
| `finished` | plating | 12 | … Glam” Ring. Crafted from anti-tarnish stainless steel and beautifully finished in radiant gold plating, this ring features an elegant infinity twist … | 18, 25, 38, 40, 43, 82, 196, 240, 296, 327, 366, 401 |
| `American diamonds` | stone | 11 | …Adjustable Ring Crafted with precision and adorned with sparkling American diamonds, this ring beautifully combines timeless charm and modern style. T… | 120, 134, 136, 138, 146, 152, 153, 154, 155, 156, 381 |
| `High-quality American Diamonds` | stone | 11 | …outfit. Product Details: Plating: Premium Rose Gold Stones: High-quality American Diamonds Size: Adjustable (Fits most finger sizes) Style: Minimal ye… | 120, 134, 136, 138, 146, 152, 153, 154, 155, 156, 381 |
| `Pearl` | stone | 11 | …on repeat, paired with cute quote cards. What's Inside: Morchadi Jewels Pearl Beaded Chain Necklace Morchadi Jewels Stud & Hoop Earrings Set (6 Pairs … | 79, 161, 207, 270, 342, 343, 454, 455 |
| `Premium Rose Gold` | material | 11 | … adds a graceful sparkle to any outfit. Product Details: Plating: Premium Rose Gold Stones: High-quality American Diamonds Size: Adjustable (Fits most… | 120, 134, 136, 138, 146, 152, 153, 154, 155, 156, 381 |
| `rose gold finish` | material + plating | 11 | …beautifully combines timeless charm and modern style. The delicate rose gold finish gives it a luxurious appeal, making it a perfect accessory for bot… | 120, 134, 136, 138, 146, 152, 153, 154, 155, 156, 381 |
| `American Diamond` | stone | 10 | …ith our DC Jewelry Petal Shine Finger Ring – Rosegold \| Adjustable American Diamond Ring — a charming symbol of elegance and grace. Whether it's a spe… | 137, 143, 243, 383, 384, 385, 416, 417 |
| `crystal-studded` | stone | 10 | …ti-tarnish for lasting brilliance Design: Dual-band style (plain + crystal-studded) Style: Minimal, elegant & versatile Comfort: Lightweight & easy to… | 38, 214, 228, 229, 232, 241, 310, 380, 409 |
| `crystals` | stone | 10 | …and design — one polished gold band and one embellished with sparkling crystals for that perfect balance of elegance and shine. Lightweight and durabl… | 38, 40, 200, 233, 238, 277, 401, 429, 430, 442 |
| `fine gold` | material | 10 | …king this pendant feel both realistic and enchanting. It hangs from a fine gold chain, ready to be worn alone as a statement or layered with simpler p… | 4, 82, 100, 193, 265, 327, 366, 393, 406, 445 |
| `silver-plated` | material + plating | 10 | …, sparkling with baguette and round CZ stones, all set on a radiant silver-plated band. The unique structure ensures the Bow Knot Designer CZ Silver-P… | 91, 164, 204, 325, 346, 416, 417, 419, 425 |
| `stainless steel` | material | 10 | …a contemporary touch to your style. Made from durable anti-tarnish stainless steel with 18K gold plating, it's perfect for those who love bold, yet mi… | 37, 69, 161, 167, 168, 258, 280, 321, 442, 449 |
| `cubic zirconia stones` | stone | 9 | …hen they sparkle. This gold-plated CZ ring spells out love with cubic zirconia stones set in a delicate message band, designed for women who wear thei… | 2, 14, 18, 94, 170, 179, 282, 301, 382 |
| `Glass` | material | 9 | …with embedded stones , giving it a festive and classy vibe. ✨ Material: Glass 💫 Quantity: 2 bangles (1 pair) Made of high-quality glass – delicate yet… | 180, 195, 263, 303, 334, 389, 403, 405, 456 |
| `Gold-Tone` | material + plating | 9 | … Set (6 Pairs – Gold Tone) Peach & Pearl Beaded Flower Charm Bracelet Gold-Tone Twisted Ring Satin Scrunchie – Ivory Rose Why She'll Love It: A comple… | 79, 80, 165, 207, 270, 308 |
| `gold-tone` | material + plating | 9 | …ryday style with our elegant A Letter Necklace . Featuring a delicate gold-tone chain and a sparkling crystal-encrusted letter “A” pendant, this neckl… | 6, 266, 280, 470, 472, 477, 480, 483 |
| `gold-tone finish` | material + plating | 9 | … bracelet — a full row of sparkling cubic zirconia stones set in a gold-tone finish that screams luxury without the price tag. Adjustable lobster clas… | 14, 75, 270, 471, 473, 474, 478, 479, 483 |
| `Golden` | material | 9 | … & perfume Images may appear brighter than the actual product due to photographic effect. Toggle Clasp Brass Package contains: 1 bracelet Color Golden | 20, 195, 280, 302, 314, 334, 389, 456 |
| `Kundan` | stone | 9 | Enhance your traditional look with this elegant Kundan bracelet watch featuring green meenakari detailing, sparkling Kundan stones, decorative ghungro… | 267, 308, 374, 451, 452 |
| `kundan` | stone | 9 | …celet watch features deep royal blue meenakari floral charms with polki kundan centres, flanking a heavily CZ stone-encrusted watch dial that shines l… | 284, 285, 286, 287, 288, 290, 292, 293 |
| `Stainless steel` | material | 9 | …ance to your style. Product: Anti-Tarnish Open Band Ring Material: Stainless steel Plating: 18K gold tone plating Finish: Anti-tarnish (long-lasting s… | 41, 66, 108, 109, 110, 169, 368, 432, 464 |
| `316L Stainless Steel` | material | 8 | …ines, and an unmistakable silhouette — a modern statement piece. 316L Stainless Steel — rust-proof, tarnish-proof & skin-safe Gold-plated finish — ric… | 108, 109, 110, 169, 368, 432, 433, 464 |
| `glossy glass finish` | material + plating | 8 | …: Emerald Green Design: Golden dotted detailing Finish: Smooth & glossy glass finish Style: Traditional / Ethnic / Festive Occasions: Wedding, Festive… | 195, 263, 303, 334, 369, 389, 404, 456 |
| `high-quality gold plating` | material + plating | 8 | …on with this premium black marble enamel kada, a Crafted with high-quality gold plating, this anti-tarnish and water-resistant piece is perfect for ev… | 31, 42, 50, 51, 52, 58, 64, 70 |
| `Rose Gold` | material | 8 | …perfume Images may appear brighter than the actual product due to photographic effect. Toggle Clasp Brass Package contains: 1 bracelet Rose Gold color | 24, 69, 72, 139, 140, 150, 151, 381 |
| `Silver` | material | 8 | …ling and lightweight 🧿 Blue evil eye bead — protective talisman charm 🌀 Silver spiral charm pendant — symbol of energy and growth ⚪ Silver accent bead… | 83, 106, 142, 190, 413 |
| `skin-safe Gold-plated finish` | material + plating | 8 | …nt piece. 316L Stainless Steel — rust-proof, tarnish-proof & skin-safe Gold-plated finish — rich, long-lasting shine Waterproof & sweat-resistant — bu… | 108, 109, 110, 169, 368, 432, 433, 464 |
| `sturdy alloy` | material | 8 | …s, or gifting Highlights / Specifications: 🔹 Material: High-quality, sturdy alloy 🔹 Plating: Lush gold plating for lasting radiance 🔹 Stone Type: Bril… | 93, 107, 203, 204, 326, 337, 340, 447 |
| `Brass base` | material | 7 | …ss, making it perfect for daily wear, parties, or gifting . Material: Brass base Plating: Premium Gold-plated finish Stone Type: Sparkling American Di… | 243, 383, 384, 385, 386, 416, 417 |
| `gold-plated finish` | material + plating | 7 | …ir heart with quiet confidence. Crafted from quality alloy with a gold-plated finish, the band features brilliant CZ stones arranged in the iconic lov… | 2, 10, 202, 326, 331, 340, 427 |
| `clear crystal` | stone | 6 | …tal petal and a emerald-green crystal base, finished with sparkling clear crystal spacers along the chain. The asymmetrical, multi-drop design gives t… | 240, 327, 486, 490 |
| `Crystal` | stone | 6 | Step into effortless elegance with this Crystal Cut-Out Band Ring , crafted from premium stainless steel and finished with rich 18K gold plating. The … | 40, 165, 263, 303, 310, 402 |
| `golden finish` | material + plating | 6 | …es with finely set stones while the other side shines with a smooth golden finish. Crafted in durable stainless steel with premium gold plating, this … | 66, 437, 438, 439, 472, 487 |
| `green stone` | stone | 6 | A sleek emerald-cut green stone set in a classic four-prong gold mounting, this pendant brings a touch of vintage-inspired elegance to everyday wear. … | 193, 196, 255, 452, 454, 476 |
| `High-quality glass` | material | 6 | …ns . Product Highlights: Set Includes: 12 Glass Bangles Material: High-quality glass Color: Emerald Green Design: Golden dotted detailing Finish: Smoo… | 195, 263, 303, 334, 389, 456 |
| `plated` | plating | 6 | …e tradition with modern elegance. Made from premium stainless steel and plated in 18K gold tone, the sleek band features a unique diamond-cut pattern … | 39, 65, 161, 167, 168, 442 |
| `polished gold` | material | 6 | …ch red enamel finish on the petals contrasts strikingly against the polished gold detailing, making this pendant feel both realistic and enchanting. I… | 4, 38, 110, 227, 366 |
| `Premium gold plating` | material + plating | 6 | …cations: Material: High-quality stainless steel / brass Plating: Premium gold plating for long-lasting shine Stone Type: Plain, no stone – minimalist … | 67, 77, 94, 96, 282, 301 |
| `premium stainless steel` | material | 6 | …Band Ring , designed with a modern minimal twist. Crafted from premium stainless steel and finished with 18K gold tone plating, the ring features a sl… | 38, 39, 40, 43, 45, 65 |
| `silver` | material | 6 | …aceted crystal beads strung together with a vibrant blue evil eye bead, silver accent beads, and a small spiral charm pendant. A beautiful blend of sp… | 83, 171, 426, 428, 429, 482 |
| `18K gold tone plated` | material + plating | 5 | …Double Band Ring Material: High-quality stainless steel Plating: 18K gold tone plated Finish: Anti-tarnish for lasting brilliance Design: Dual-band st… | 38, 39, 40, 43, 65 |
| `American Diamonds` | stone | 5 | …l gift for her Details: Plating: Rosegold Material: Brass Stones: American Diamonds Care: Avoid contact with water or perfumes. Clean with a soft clot… | 123, 126, 148, 157, 385 |
| `Anti-tarnish finish` | plating | 5 | …ld setting. Lightweight, barely-there feel with maximum sparkle. Anti-tarnish finish makes it your go-to everyday bracelet that never loses its shine. | 9, 12, 13, 15, 23 |
| `anti-tarnish finish` | plating | 5 | …ersatile design makes it a perfect everyday accessory, while the anti-tarnish finish ensures long-lasting shine and durability. Lightweight, comfortab… | 39, 41, 475, 478, 481 |
| `anti-tarnish stainless steel` | material | 5 | …e timeless style with the “Infinity Glam” Ring. Crafted from anti-tarnish stainless steel and beautifully finished in radiant gold plating, this ring … | 18, 25, 27, 72, 167 |
| `Emerald` | stone | 5 | Bold and beautiful — our Amethyst Purple & Emerald Vine Anti-Tarnish Necklace features rich deep purple oval CZ stones set against vibrant emerald gre… | 8, 199, 353, 363, 376 |
| `gold finish` | material + plating | 5 | …tement with this double-layer twisted snake chain bracelet in a rich gold finish. Two intertwined flat snake chains flow beautifully together, secured… | 16, 26, 257, 367, 387 |
| `gold-finished` | material + plating | 5 | …pendant necklace. Featuring a sparkling pink crystal bud on a sleek gold-finished snake chain, this pastoral-style accessory adds a touch of versatile… | 89, 226, 234, 347, 378 |
| `High-quality stainless steel` | material | 5 | …experience. Product: Anti-Tarnish Double Band Ring Material: High-quality stainless steel Plating: 18K gold tone plated Finish: Anti-tarnish for lasti… | 38, 39, 43, 65, 67 |
| `pink crystal` | stone | 5 | …tyle with this elegant tulip pendant necklace. Featuring a sparkling pink crystal bud on a sleek gold-finished snake chain, this pastoral-style access… | 89, 296 |
| `Premium Gold-plated finish` | material + plating | 5 | …ily wear, parties, or gifting . Material: Brass base Plating: Premium Gold-plated finish Stone Type: Sparkling American Diamond (AD) Design: Knot-styl… | 243, 383, 384, 385, 386 |
| `Premium Zircon Stones` | stone | 5 | … Steel (Anti-Tarnish) Plating: 18k Gold Tone Plated Stone Type: Premium Zircon Stones Design: Criss-cross infinity wave (one studded, one sleek) Colou… | 44, 45, 68, 69, 72 |
| `Rosegold Finish` | plating | 5 | Shine bright with our DC Jewelry Butterfly Duo Ring – Rosegold Finish \| Adjustable CZ Ring (F1254) — a charming symbol of elegance and grace. Whether … | 116, 121, 124, 130, 135 |
| `round cubic zirconia` | stone | 5 | …ating for lasting shine 🔹 Stone Type: Sparkling baguette-cut and round cubic zirconia 🔹 Design: Statement double band with solitaire centerpiece 🔹 Siz… | 76, 91, 96, 112, 326 |
| `stone-studded` | stone | 5 | …tarnish (long-lasting shine) Design: Open band with one plain & one stone-studded end Fit: Adjustable – fits any finger Style: Minimalist, modern & ve… | 41, 66, 160, 211, 302 |
| `18K gold` | material | 4 | …etals. Crafted from durable anti-tarnish stainless steel and plated in 18K gold, it's a versatile piece that adds a fresh, feminine touch to any outfi… | 161, 167, 168, 442 |
| `18K gold plating` | material + plating | 4 | …to your style. Made from durable anti-tarnish stainless steel with 18K gold plating, it's perfect for those who love bold, yet minimalist, accessories… | 37, 40, 41, 321 |
| `18K gold tone plating` | material + plating | 4 | …l twist. Crafted from premium stainless steel and finished with 18K gold tone plating, the ring features a sleek dual-band design — one polished gold … | 38, 41, 43, 66 |
| `CZ stone` | stone | 4 | …ssly wearable — this gold bead chain bracelet features a dainty square CZ stone charm that adds just the right touch of sparkle. Adjustable lobster cl… | 13, 273, 295, 301 |
| `CZ-studded` | stone | 4 | …ng features a large baguette-cut CZ stone set between two shimmering, CZ-studded bands, creating a look of pure elegance and grace. The stylish double… | 76, 93, 257, 342 |
| `dipped` | plating | 4 | … not soak your jewelry in water. Clean your jewelry using a soft brush, dipped in a jewelry cleaning solution only. Keywords: charm bracelet, designer… | 166, 199, 258, 274 |
| `durable anti-tarnish stainless steel` | material | 4 | …rn, adding a contemporary touch to your style. Made from durable anti-tarnish stainless steel with 18K gold plating, it's perfect for those who love b… | 37, 161, 168, 442 |
| `emerald green glass` | material + stone | 4 | …ic Indian elegance to your jewelry collection with this stunning emerald green glass bangles set , featuring 12 beautifully crafted bangles . Designed… | 195, 268, 369, 466 |
| `green glass` | material | 4 | Brighten your ethnic look with this charming lime green glass bangles set , featuring 12 beautifully crafted bangles designed to create a vibrant and … | 303, 335, 406 |
| `High-quality gold plating` | material + plating | 4 | …ecifications Material: Premium gold-tone metal alloy Plating: High-quality gold plating for enduring shine Stone Type: Sparkling cubic zirconia Design… | 179, 202, 203, 326 |
| `Kundan stones` | stone | 4 | … choker necklace set . Designed with intricate enamel work, premium Kundan stones, and lustrous pearl drops, this jewelry set combines tradition with … | 266, 267, 374, 452 |
| `multicolor glass` | material | 4 | Description: Bring vibrant elegance to your ethnic style with this multicolor glass bangle set beautifully adorned with shimmering stones. Featuring r… | 73, 162, 404 |
| `pink glass` | material | 4 | Make a bold and beautiful statement with this stunning set of 12 hot pink glass bangles. Crafted from high-quality glass, these bangles feature a vibr… | 275, 352, 468 |
| `Premium antique gold finish` | material + plating | 4 | …sarees, lehengas, kurtis, and Indo-western outfits. Features Premium antique gold finish Elegant red meenakari detailing Sparkling Kundan stone work D… | 374, 451, 452, 454 |
| `Premium red glass` | material | 4 | …idal jewelry, festive looks, or thoughtful gifting. Key Features: Premium red glass bangles with intricate golden bead embellishments Handcrafted for … | 351, 375, 403, 405 |
| `Premium silver-finish` | material + plating | 4 | Elegant black gemstone statement ring Premium silver-finish with classic detailing Minimal yet bold design for effortless styling Lightweight & comfor… | 84, 269, 377, 484 |
| `premium zircon stones` | stone | 4 | … that blends elegance with modern charm. One side sparkles with premium zircon stones, while the other shines with a sleek gold-plated finish—perfect … | 10, 68, 69, 72 |
| `premium-quality alloy` | material | 4 | … any occasion Highlights / Specifications: 🔹 Material: Durable, premium-quality alloy 🔹 Plating: Rich gold plating ensures long-lasting shine 🔹 Stone … | 90, 91, 296, 371 |
| `Rose gold-plated` | material + plating | 4 | Shine with elegance in this Rose gold-plated adjustable band ring , featuring a sleek double row of sparkling American Diamond stones . Designed for c… | 383, 384, 385, 386 |
| `Solitaire CZ Gold-Plated` | material + plating + stone | 4 | …duct Description: Radiate graceful beauty with the Floral Halo Solitaire CZ Gold-Plated Ring for Women . This exquisite ring features a radiant round … | 203, 273 |
| `18k Gold Tone Plated` | material + plating | 3 | …ry collection. Material: Stainless Steel (Anti-Tarnish) Plating: 18k Gold Tone Plated Stone Type: Premium Zircon Stones Design: Criss-cross infinity w… | 44, 45, 68 |
| `alloy` | material | 3 | Product Details Gold-toned chain Material and stone type: alloy Size & Fit Chain Length:45 cm + 5 cm Pendant:2 cm x 2 cm (Length x Width) Material & C… | 274, 460, 488 |
| `American Diamond stones` | stone | 3 | …s gold-plated adjustable knot ring , embellished with dazzling American Diamond stones . Its chic knot design symbolizes love and togetherness, making… | 243, 383, 384 |
| `blue glass` | material | 3 | Description: Elevate your ethnic look with this royal blue glass bangle set adorned with delicate golden polka-dot detailing . Crafted from premium-qu… | 85, 389 |
| `crystal-style` | stone | 3 | …ludes 12 finely designed glass bangles , each adorned with delicate crystal-style dotted embellishments that shimmer beautifully under light, giving a… | 263, 303, 479 |
| `Diamond` | stone | 3 | Bold, structured, and strikingly unique — our Diamond Petal Fringe Hoop Earrings feature a cascading row of raised oval petals along the hoop with a s… | 169, 449 |
| `filled` | plating | 3 | …eautiful surprises! 💛 Our Classic Mystery Jewellery Jar is thoughtfully filled with 3–4 surprise jewellery pieces featuring a mix of trendy anti-tarni… | 98, 465 |
| `Gold Tone Plated` | material + plating | 3 | … or for gifting. Material: Stainless Steel (Anti-Tarnish) Plating: Gold Tone Plated Stone Type: Premium Cubic Zirconia Design: Infinity/Twist Linked B… | 18, 25, 27 |
| `gold-toned stainless-steel` | material + plating | 3 | Elevate your everyday look with these gold-toned stainless-steel hoops featuring a unique, textured bamboo-inspired design. These fashionable earrings… | 435, 438, 439 |
| `green enamel` | material | 3 | Add a pop of color to your wrist with this stunning green enamel kada. Crafted with a premium anti-tarnish gold finish, it offers long-lasting shine a… | 182, 194, 287 |
| `Hand-finished` | plating | 3 | … 8 → Diameter: 1.8cm Best Use: Daily wear, party wear, stacking, gifting Packaging: Premium black velvet box Note: Hand-finished—every piece is unique | 18, 25, 27 |
| `high-quality gold-plated finish` | material + plating | 3 | …e with this premium blue ombre enamel kada. Crafted with a high-quality gold-plated finish, its anti-tarnish and water-resistant properties ensure lon… | 33, 53, 60 |
| `pearls` | stone | 3 | …. The necklace features multiple strands of green beads interwoven with pearls, creating a rich and graceful silhouette. The matching earrings mirror … | 266, 286, 343 |
| `Premium black velvet` | material | 3 | … 8 → Diameter: 1.8cm Best Use: Daily wear, party wear, stacking, gifting Packaging: Premium black velvet box Note: Hand-finished—every piece is unique | 18, 25, 27 |
| `Premium Glass` | material | 3 | … or daily wear, they add a vibrant charm to every outfit. Material: Premium Glass Work: Stone-studded design Colors: Dual-tone multicolor (Green, Yell… | 177, 302, 335 |
| `purple glass` | material | 3 | Enrich your ethnic look with this striking set of 12 deep purple glass bangles and 4 golden ghoonghroo bangles. This fashionable ensemble adds a beaut… | 163, 391, 392 |
| `round CZ stones` | stone | 3 | …eatures a captivating bow knot design, sparkling with baguette and round CZ stones, all set on a radiant silver-plated band. The unique structure ensu… | 91, 326 |
| `silver finish` | material + plating | 3 | …its. The subtle shimmer of the petals combined with the high-polish silver finish makes them a versatile and elegant addition to your jewelry collecti… | 164, 277, 425 |
| `silver plating` | material + plating | 3 | …ions: 🔹 Material: Durable and premium-quality alloy 🔹 Plating: Rich silver plating for lasting brilliance 🔹 Stone Type: Radiant baguette and round cub… | 91, 173, 204 |
| `white quartz` | stone | 3 | …h features delicate red & green lotus kundan charms flanking a clean white quartz dial, all strung together on a gold chain adorned with cheerful ghun… | 288, 292, 293 |
| `18k gold plated` | material + plating | 2 | …ower pendant, pearl necklace, anti-tarnish jewelry, stainless steel, elegant necklace, feminine jewelry, gift for her, 18k gold plated, floral jewelry | 161, 442 |
| `18K gold tone` | material + plating | 2 | …th modern elegance. Made from premium stainless steel and plated in 18K gold tone, the sleek band features a unique diamond-cut pattern studded with b… | 39, 65 |
| `18k gold tone plating` | material + plating | 2 | …nd sparkles with zircon stones while the other gleams in smooth 18k gold tone plating. Lightweight, adjustable, and handmade with care, this ring is p… | 44, 45 |
| `18k Rose Gold Tone Plated` | material + plating | 2 | …or gifting. Material: Stainless Steel (Anti-Tarnish) Plating: 18k Rose Gold Tone Plated Stone Type: Premium Zircon Stones Design: V-shape chevron band… | 69, 72 |
| `18k rose gold tone plating` | material + plating | 2 | …ction with the Anti-Tarnish V-Shape Chevron Ring . Crafted in 18k rose gold tone plating, this sleek V-band sparkles with premium zircon stones, makin… | 69, 72 |
| `Alloy` | material | 2 | … Name: Traditional Kundan Bracelet Watch Type: Bracelet Watch Material: Alloy Finish: Antique Gold Design: Green Meenakari with Kundan Stones Stone Ty… | 267, 274 |
| `Anti-Tarnish Silver` | material | 2 | Add timeless elegance to your everyday style with this Vintage Anti-Tarnish Silver Bracelet Watch , featuring a stunning deep blue round dial and an i… | 481, 482 |
| `Anti-tarnish silver-tone finish` | material + plating | 2 | …uct Highlights ✨ Vintage-inspired jewellery watch design 💎 Anti-tarnish silver-tone finish 💙 Elegant deep blue round dial ⌚ Quartz movement 🔗 Detailed… | 481, 482 |
| `antique gold finish` | material + plating | 2 | …th this Traditional Kundan Bracelet Watch , featuring an elegant antique gold finish, sparkling Kundan stones, vibrant red & green accents, and delica… | 452, 454 |
| `Artificial Stones` | stone | 2 | …se Material: Stainless Steel Plating: 18K Gold-Plated Stone Type: Artificial Stones Closure: Lobster Clasp Length: 45 cm (Adjustable) Perfect for laye… | 160, 199 |
| `Baguette CZ Gold-Plated` | material + plating + stone | 2 | …escription: Step out in style with the captivating Rectangular Baguette CZ Gold-Plated Ring for Women . This unique bar ring boasts a sleek gold-plate… | 371 |
| `Baguette Solitaire CZ Gold-Plated` | material + plating + stone | 2 | Product Description: Sparkle with sophistication in the Baguette Solitaire CZ Gold-Plated Ring for Women . This stunning ring features a large baguett… | 76 |
| `Clear cubic zirconia` | stone | 2 | … gold-plated stainless steel, tarnish and water resistant Stone: Clear cubic zirconia accents Chain: Fine link chain, adjustable length Pendant size: … | 445, 490 |
| `clear white marquise CZ stones` | stone | 2 | …ystal Diamond Vine Anti-Tarnish Necklace features sparkling clear white marquise CZ stones arranged in an elegant V-shaped vine design on a gold-plate… | 111 |
| `cowrie shell` | material | 2 | …d-Plated Ring for Women . This eye-catching ring features a stunning cowrie shell silhouette encrusted with brilliant cubic zirconia, set on a rich go… | 107 |
| `Cowrie Shell CZ Gold-Plated` | material + plating + stone | 2 | …roduct Description: Embrace beach-inspired elegance with the Cowrie Shell CZ Gold-Plated Ring for Women . This eye-catching ring features a stunning c… | 107 |
| `Crystal Stones` | stone | 2 | …old Design: Green Meenakari with Kundan Stones Stone Type: Kundan & Crystal Stones Dial Shape: Round Closure: Adjustable Chain Occasion: Wedding, Fest… | 267, 277 |
| `crystal-encrusted` | stone | 2 | …r Necklace . Featuring a delicate gold-tone chain and a sparkling crystal-encrusted letter “A” pendant, this necklace is a beautiful choice for celebr… | 6, 224 |
| `Cubic Zirconia` | stone | 2 | …: Quality alloy Plating: Gold-tone, tarnish-resistant finish Stone: Cubic Zirconia Fit: Adjustable, fits most finger sizes Occasion: Daily wear, anniv… | 2, 27 |
| `CZ Silver-Plated` | material + plating + stone | 2 | …ion: Add a touch of chic sophistication with the Bow Knot Designer CZ Silver-Plated Ring for Women . This elegant ring features a captivating bow knot… | 91 |
| `CZ Stone Gold-Plated` | material + plating + stone | 2 | …uct Description: Step up your shine with the luxurious Rectangle CZ Stone Gold-Plated Statement Ring for Women . This bold ring features a multi-row r… | 370 |
| `CZ stone-encrusted` | stone | 2 | …akari floral charms with polki kundan centres, flanking a heavily CZ stone-encrusted watch dial that shines like royalty. Intricate kundan medallion b… | 284, 291 |
| `dual-toned` | plating | 2 | …ater-resistant properties ensure long-lasting brilliance. This sleek, dual-toned statement piece offers a luxurious, modern aesthetic that maintains i… | 49, 63 |
| `durable finish` | plating | 2 | …ust-have for those who love unique accessories! 💰 Premium quality & durable finish 🚚 Delivery Time: 3-5 days (subject to stock availability) 📲 Need it… | 304, 335 |
| `durable stainless steel` | material | 2 | …en band ring that blends minimalism with sparkle. Crafted from durable stainless steel with 18K gold plating, one side of the band shines with delicat… | 41, 66 |
| `emerald` | stone | 2 | … touch of elegance to your everyday look with this stunning DC Jewelry emerald cut adjustable ring Crafted with precision and adorned with sparkling A… | 154, 254 |
| `Emerald-Cut CZ Silver-Plated` | material + plating + stone | 2 | … Description: Radiate with sophistication wearing the Double Emerald-Cut CZ Silver-Plated Ring for Women . This dazzling ring features two large emera… | 173 |
| `Emerald-cut green cubic zirconia` | stone | 2 | …plated stainless steel, tarnish and water resistant Stone: Emerald-cut green cubic zirconia, four-prong gold setting Chain: Fine link chain, adjustabl… | 193, 196 |
| `emerald-cut green stone` | stone | 2 | A sleek emerald-cut green stone set in a classic four-prong gold mounting, this pendant brings a touch of vintage-inspired elegance to everyday wear. … | 193, 196 |
| `Enamel` | material | 2 | …o your look. Material: Stainless Steel Plating: Gold-Plated Stone type: Enamel Closure: Lobster closure Warranty: 1 month, provided by brand owner/man… | 258, 373 |
| `fabric` | material | 2 | …h a flattering halter neckline and crafted from lightweight, breathable fabric, this top combines comfort with timeless ethnic artistry. Perfect for c… | 276, 348 |
| `Fabric Rose` | material | 2 | …ch & Pearl Beaded Flower Charm Bracelet Gold-Tone Twisted Ring Satin Fabric Rose Hair Tie – Ivory Acrylic Flower Hair Claw Clip – Yellow Why She'll Lo… | 270, 308 |
| `fine stone` | stone | 2 | …casions . Handcrafted with premium-quality glass and embellished with fine stone detailing, each bangle exudes traditional charm while offering a comf… | 73, 302 |
| `Gold Plated` | material + plating | 2 | This Gold Plated Contemporary Stackable Rings Set of 11 balances design, versatility, and craftsmanship, making it an ideal addition to any collection | 237, 458 |
| `gold plated` | material + plating | 2 | … minimalist jewelry, anti-tarnish necklace, stainless steel jewelry, gold plated necklace, dainty necklace, everyday jewelry, celestial necklace, rect… | 321, 329 |
| `Gold Tone` | material + plating | 2 | …ed Chain Necklace Morchadi Jewels Stud & Hoop Earrings Set (6 Pairs – Gold Tone) Peach & Pearl Beaded Flower Charm Bracelet Gold-Tone Twisted Ring Sat… | 79, 165 |
| `gold-finished copper` | material + plating | 2 | This innovative gold-finished copper ring features a unique, openable heart or round locket design. Lightweight and adjustable, it allows you to custo… | 225, 493 |
| `Gold-tone` | material + plating | 2 | …stive outfits alike. Product Details Material: Quality alloy Plating: Gold-tone, tarnish-resistant finish Stone: Cubic Zirconia Fit: Adjustable, fits … | 2, 263 |
| `gold-tone quartz` | material + plating + stone | 2 | …d pink floral motifs and sparkling kundan accents, framing a clean gold-tone quartz dial. Ghungroo bells add a playful jingle to every move. Lightweig… | 285, 295 |
| `golden stone` | material + stone | 2 | … these light golden transparent glass bangles, adorned with delicate golden stone work. Elegant, lightweight, and versatile—perfect for weddings, fest… | 302, 457 |
| `green Kundan` | stone | 2 | Add a touch of regal elegance to your ethnic look with this stunning green Kundan choker necklace set . Designed with intricate enamel work, premium K… | 266 |
| `green stones` | stone | 2 | Elegant anti tarnish bracelet with sparkling green stones and a delicate gold vine design. Lightweight, stylish, and perfect for daily wear or gifting… | 198, 454 |
| `high-quality alloy` | material | 2 | …oughtful gifting Highlights / Specifications: 🔹 Material: Sturdy, high-quality alloy 🔹 Plating: Premium gold plating for lasting brilliance 🔹 Stone Ty… | 77, 296 |
| `Kundan stone` | stone | 2 | …racelet Watch , featuring elegant red meenakari detailing, sparkling Kundan stones, decorative ghungroo charms, and graceful chain tassels. Crafted wi… | 374, 452 |
| `Marquise CZ Stone Gold-Plated` | material + plating + stone | 2 | …escription: Embrace natural elegance with the stunning Leaf Marquise CZ Stone Gold-Plated Ring for Women . Featuring a captivating marquise-shaped sto… | 300 |
| `mint stones` | stone | 2 | …ing gold-plated mint green floral stud earrings . Designed with soft mint stones arranged around a sparkling crystal center, these earrings bring a pe… | 252, 325 |
| `orange enamel finish` | material + plating | 2 | …celet features a wide dome-shaped gold-plated bangle with a rich orange enamel finish and intricate raised gold floral and leaf vine detailing across … | 336 |
| `oval CZ solitaire` | stone | 2 | …d Ring for Women . This captivating ring features an eye-catching oval CZ solitaire embraced by a shimmering swirl of pavé-set stones, all set on a lu… | 337 |
| `pink CZ` | stone | 2 | Add a pop of color to your style with this beautiful pink CZ tennis necklace set , crafted with sparkling pink zircon stones set in a sleek silver-pla… | 346, 349 |
| `pink enamel` | material | 2 | Embrace a soft, feminine look with this elegant pink enamel tulip necklace. Featuring high-shine "dripping oil" petals and vibrant green leaves on a s… | 347, 467 |
| `pink stone` | stone | 2 | Premium birthday jewellery hamper with pink stone bracelet, heart necklace, bamboo hoop earrings, pearl bracelet with tulip charm, scrunchie, baby bre… | 307, 346 |
| `Plating- 18k gold tone plated` | material + plating | 2 | …cm Size 8 → Diameter: 1.8 cm Weight - 1.4gm Height - 1.8 cm Plating- 18k gold tone plated Material- Stainless Steel You will receive the ring in a box… | 10, 11 |
| `polished gold-toned` | material + plating | 2 | …elet. Featuring a shimmering crystal-studded heart joined with a polished gold-toned heart, this high-fashion piece adds instant romance to any look. … | 232, 328 |
| `polished golden finish` | material + plating | 2 | …chain strap. The deep green dial beautifully contrasts with the polished golden finish, creating a sophisticated vintage-inspired look. Its petite rou… | 476, 477 |
| `Premium alloy` | material | 2 | … glam or special occasions Highlights / Specifications: 🔹 Material: Premium alloy ensures lasting shine and durability 🔹 Plating: Luxurious gold plati… | 176, 185 |
| `Premium Cubic Zirconia` | stone | 2 | …less Steel (Anti-Tarnish) Plating: Gold Tone Plated Stone Type: Premium Cubic Zirconia Design: Infinity/Twist Linked Band, Half Studded Color: Gold Si… | 18, 25 |
| `Premium glass` | material | 2 | …ure to become a timeless piece in your jewellery box. Key Features: Premium glass bangles with sparkling stones Stunning multicolor design for versati… | 73, 339 |
| `premium gold plating` | material + plating | 2 | … a smooth golden finish. Crafted in durable stainless steel with premium gold plating, this ring is built to last with an anti-tarnish coating and an … | 66, 179 |
| `Premium Silver-plated finish` | material + plating | 2 | …inimalism with sophistication. Material: Brass base Plating: Premium Silver-plated finish Stone Type: Sparkling American Diamond (AD) Design: Criss-cr… | 416, 417 |
| `princess-cut stone` | stone | 2 | …is gorgeous ring features two dazzling designs—one with a radiant princess-cut stone, and the other with a charming floral motif surrounded by shimmer… | 176, 185 |
| `princess-cut stones` | stone | 2 | …ious gold-plated finish. Featuring a vibrant mix of marquise and princess-cut stones in pink, mint green, amber, lavender, and clear CZ, these earring… | 331, 361 |
| `purple enamel` | material | 2 | Make a statement with this vibrant purple enamel flower necklace. Featuring a lustrous metallic finish and a dainty gold-toned chain, this anti-tarnis… | 365, 366 |
| `purple marquise CZ stones` | stone | 2 | …aturing a delicate alternating pattern of blush pink and deep purple marquise CZ stones with gold leaf accents. The soft ombre colour play makes this … | 344 |
| `purple oval CZ stones` | stone | 2 | … Purple & Emerald Vine Anti-Tarnish Necklace features rich deep purple oval CZ stones set against vibrant emerald green leaf accents on a gold-plated … | 8, 363 |
| `red enamel` | material | 2 | …finity patterns, enhanced with sparkling stones and a subtle touch of red enamel for a unique and vibrant charm. Lightweight and comfortable, this rin… | 43, 372 |
| `rose gold-toned` | material + plating | 2 | Elevate your style with this stunning rose gold-toned tennis bracelet, featuring a brilliant solitaire crystal. Perfect for adding high-fashion glamou… | 187, 188 |
| `round CZ stone` | stone | 2 | …Gold-Plated Ring for Women . This exquisite ring features a radiant round CZ stone encircled by a delicate floral halo, all atop a richly gold-plated … | 203, 204 |
| `Round-cut cubic zirconia` | stone | 2 | …gh-quality gold plating for luxurious brilliance 🔹 Stone Type: Round-cut cubic zirconia in solitaire & halo setting 🔹 Design: Floral halo motif with s… | 203, 204 |
| `Ruby` | stone | 2 | …xe "just because" surprise. What's Inside: Gold-Tone Rope Chain Bracelet Ruby & Emerald Stone Necklace Gold-Tone Twisted Hoop Earrings Satin Scrunchie… | 80, 165 |
| `ruby` | stone | 2 | …s tradition with this stunning gold-toned nath, intricately studded with ruby and emerald-colored stones. A perfect high-fashion accessory for festive… | 242, 254 |
| `Silver Tone` | material + plating | 2 | …d-Tone Charm anklet– Star & Flower Charms Personalized Initial Ring (Silver Tone, Gift Box Included) Gold-Tone Hoop Earrings Satin Rose Scrunchie – Bl… | 165, 207 |
| `Silver-Plated` | material + plating | 2 | … Description: Embrace graceful charm with the Double Butterfly Wing Silver-Plated Ring for Women . This enchanting ring features two delicate butterfl… | 171 |
| `silver-plated finish` | material + plating | 2 | …Sophisticated bow knot motif with brilliant CZ sparkle ✨ Elegant silver-plated finish for versatile style ✨ Adjustable fit for all-day comfort ✨ The p… | 91, 346 |
| `Solitaire CZ Silver-Plated` | material + plating + stone | 2 | …cription: Elevate your elegance with the timeless Floral Halo Solitaire CZ Silver-Plated Ring for Women . This dazzling ring features a brilliant roun… | 204 |
| `Stone` | stone | 2 | … a thoughtful gift for someone special. Product: Anti-Tarnish Geometric Stone Band Ring Material: High-quality stainless steel Plating: 18K gold tone … | 39, 133 |
| `Stone-studded` | stone | 2 | … add a vibrant charm to every outfit. Material: Premium Glass Work: Stone-studded design Colors: Dual-tone multicolor (Green, Yellow, Pink, Orange) De… | 177, 335 |
| `tarnish-resistant finish` | plating | 2 | …e. Product Details Material: Quality alloy Plating: Gold-tone, tarnish-resistant finish Stone: Cubic Zirconia Fit: Adjustable, fits most finger sizes … | 2, 227 |
| `white crystal` | stone | 2 | …d bracelet featuring five blush pink floral CZ charms and sparkling white crystal leaf accents along a delicate vine chain. The centrepiece flower is … | 349 |
| `white enamel` | material | 2 | …. This vibrant, dual-toned statement piece features striking red and white enamel sections that offer a luxurious, contemporary aesthetic, maintaining… | 63, 491 |
| `zircon` | stone | 2 | …ce with its interlocked chain-style design. Alternating gold-plated and zircon-studded links create a dazzling effect, making this ring a chic and ver… | 45, 346 |
| `zircon stones` | stone | 2 | …ce with intricate twisted band accents beautifully set with smaller zircon stones. Designed with a fixed size for a comfortable fit, it’s perfect for … | 27, 44 |
| `14K gold-plated copper` | material + plating | 1 | …elegance with this stunning tulip floral bracelet. Crafted from 14K gold-plated copper, it features a shimmering cat’s eye stone bud and crystal-accen… | 239 |
| `18K Gold Base` | material | 1 | …nspired Heart Pendant Necklace Intricate Rose Design Premium Quality \| Anti-Tarnish Base Material: Stainless Steel Plating: 18K Gold Base Colour: Gold | 264 |
| `18k gold tone` | material + plating | 1 | …olizing eternal elegance. Crafted in stainless steel with a radiant 18k gold tone, this waterproof and anti-tarnish necklace effortlessly enhances cas… | 280 |
| `18K gold-plated` | material + plating | 1 | …h a sparkling diamond-like stone at its center, this anti-tarnish, 18K gold-plated necklace adds a touch of classic romance to your look. Perfect for … | 449 |
| `Alloy base` | material | 1 | …and looks beautiful worn alone or stacked with other rings. Material: Alloy base Plating: Rose gold plated Stone Type: Cubic zirconia stones Design: V… | 382 |
| `Alloy metal` | material | 1 | …ment ring and complements both ethnic and western outfits. Material: Alloy metal Plating: Gold finish Stone Type: Pave-set cubic zirconia Design: Rope… | 380 |
| `Amethyst Purple` | stone | 1 | Bold and beautiful — our Amethyst Purple & Emerald Vine Anti-Tarnish Necklace features rich deep purple oval CZ stones set against vibrant emerald gre… | 8 |
| `amethyst purple oval CZ` | stone | 1 | …ands attention. 💛 Gold-plated with anti-tarnish coating 💜 Deep amethyst purple oval CZ + emerald green leaf stones 🌿 V-shaped vine pendant — bold yet … | 8 |
| `Amethyst-purple cubic zirconia` | stone | 1 | …-plated stainless steel, tarnish and water resistant Stone: Amethyst-purple cubic zirconia, bar bezel setting Chain: Fine link chain, adjustable lengt… | 82 |
| `amethyst-purple stone` | stone | 1 | A minimalist rectangular bar pendant set with a rich amethyst-purple stone, finished with a smooth gold bezel. The horizontal bar design sits centered… | 82 |
| `Anti-Tarnish Alloy` | material | 1 | …Details: • Color: Gold • Design: Hug Hands • Size: Adjustable • Material: Anti-Tarnish Alloy 🎁 Perfect gift for girlfriend, best friend, or self-love. | 230 |
| `Anti-Tarnish Crystal` | stone | 1 | …ece is a must-have addition to your jewelry collection. Product: Anti-Tarnish Crystal Cut-Out Band Ring Material: Premium stainless steel Plating: 18K… | 40 |
| `Anti-Tarnish Finish` | plating | 1 | …r, and special occasions. A timeless accessory for every woman. ✨ Adjustable Fit ✨ Shining Crystal Stones ✨ Anti-Tarnish Finish ✨ Perfect Gift for Her | 277 |
| `anti-tarnish gold` | material | 1 | … centerpiece flanked by shimmering crystal-encrusted leaves, this anti-tarnish gold chain is a perfect reminder that life is magical. A beautiful, nat… | 224 |
| `Anti-Tarnish Gold-Tone` | material + plating | 1 | …ys, anniversaries, weddings, or festive gifting. What's Inside: Anti-Tarnish Gold-Tone Charm Bracelets (Set of 2 – Floral Design) D'Pary Kundan Drop E… | 308 |
| `Anti-Tarnish Pearl` | stone | 1 | … aesthetic Pinterest-y birthday hamper for her ✨ 👗 Halter Top \| 💎 Anti-Tarnish Pearl Bracelet \| 🌸 Claw Clips x2 \| 🎀 Scrunchies \| 📝 Sticky Notes \| 🍫 Da… | 357 |
| `antique finish` | plating | 1 | …ts adjustable chain provides a comfortable fit, while the luxurious antique finish makes it a statement accessory for every jewelry collection. Featur… | 451 |
| `Antique Gold` | material | 1 | …l Kundan Bracelet Watch Type: Bracelet Watch Material: Alloy Finish: Antique Gold Design: Green Meenakari with Kundan Stones Stone Type: Kundan & Crys… | 267 |
| `Antique Gold Kundan` | material + stone | 1 | Celebrate timeless elegance with this exquisite Antique Gold Kundan Bracelet Watch , beautifully crafted with intricate floral motifs, sparkling white… | 451 |
| `Artificial Crystal` | stone | 1 | 1pc of Minimalist Stainless Steel Ring with Artificial Crystal, a French-Style Exquisite High-End Ring Featuring Birthstones of The 12 Zodiac Signs, P… | 323 |
| `baguette CZ stones` | stone | 1 | …Chic rectangular bar design for a fashion-forward look ✨ Stunning baguette CZ stones for brilliant shine ✨ Adjustable fit ensures lasting comfort ✨ Pe… | 371 |
| `Baguette-cut crystal` | stone | 1 | …Premium silver-tone finish Sparkling crystal-studded floral dial Baguette-cut crystal bracelet Adjustable slider closure for a perfect fit Lightweight… | 310 |
| `baguette-cut crystal` | stone | 1 | …dded floral dial and a premium silver-tone finish. The sparkling baguette-cut crystal bracelet and adjustable slider closure offer both style and comf… | 310 |
| `baguette-cut crystals` | stone | 1 | …are solitaire centerpiece surrounded by a full row of sparkling baguette-cut crystals. The box clasp ensures a secure, elegant closure. Anti-tarnish f… | 15 |
| `baguette-cut cubic zirconia` | stone | 1 | …y gold plating for a luxurious touch 🔹 Stone Type: Sparkling baguette-cut cubic zirconia 🔹 Design: Modern rectangular bar with linear stone setting 🔹 … | 371 |
| `baguette-cut CZ stone` | stone | 1 | …old-Plated Ring for Women . This stunning ring features a large baguette-cut CZ stone set between two shimmering, CZ-studded bands, creating a look of… | 76 |
| `baguette-cut CZ stones` | stone | 1 | …e bar ring boasts a sleek gold-plated frame set with shimmering baguette-cut CZ stones for a contemporary yet timeless feel. Designed to redefine eleg… | 371 |
| `Black Crystal` | stone | 1 | Wear your protection in style — our Black Crystal Evil Eye & Spiral Charm Anklet features sparkling jet black faceted crystal beads strung together wi… | 83 |
| `black gemstone` | stone | 1 | Elegant black gemstone statement ring Premium silver-finish with classic detailing Minimal yet bold design for effortless styling Lightweight & comfor… | 84 |
| `Black Velvet` | material | 1 | …bric Flower Hair Clip – Yellow Nail Polish Remover Paper Soap Sheets Black Velvet Box with 12 Pairs of Earrings Why She'll Love It: A complete jewelle… | 308 |
| `Blue Synthetic Zirconia Stones` | stone | 1 | …gagement Ring for Women, Featuring a Delicate Band Set with Blue Synthetic Zirconia Stones, Perfect for Weddings, Daily Wear, Parties, And As a Valent… | 324 |
| `brass` | material | 1 | …. Highlights / Specifications: Material: High-quality stainless steel / brass Plating: Premium gold plating for long-lasting shine Stone Type: Plain, … | 67 |
| `brilliant-cut cubic zirconia stones` | stone | 1 | …ted with a shiny silver-tone finish and embellished with brilliant-cut cubic zirconia stones. Featuring a stylish star-shaped ring paired with a match… | 426 |
| `clear CZ` | stone | 1 | …uise and princess-cut stones in pink, mint green, amber, lavender, and clear CZ, these earrings create a dazzling floral burst design that instantly c… | 331 |
| `clear glass` | material | 1 | … is lightweight yet durable, offering comfort for extended wear. The clear glass with golden accents pairs effortlessly with sarees, lehengas, salwar … | 302 |
| `clear glass base` | material | 1 | …ese bangles offer a graceful balance of simplicity and luxury. The clear glass base enhances the golden detailing, making the design versatile and eas… | 456 |
| `coated` | plating | 1 | …he “Twisted Solitaire” Ring. Made from anti-tarnish stainless steel and coated with radiant gold plating, this exquisite ring features a sparkling sol… | 27 |
| `copper` | material | 1 | …gh-end colorful zirconia necklace and earring set. Featuring a delicate copper leaf design and shimmering multi-colored synthetic stones, this Europea… | 104 |
| `Coral Pink` | stone | 1 | …ir types Aesthetic, trending Korean-style hair accessory Available in Coral Pink, Ivory Cream, Lilac Purple & Champagne Beige Perfect for daily wear, … | 459 |
| `Cowrie shell` | material | 1 | …ting shine 🔹 Stone Type: Brilliant pavé-set cubic zirconia 🔹 Design: Cowrie shell silhouette with open center 🔹 Size/Fit: Adjustable for most finger s… | 107 |
| `Crystal Diamond` | stone | 1 | Timeless and sophisticated — our Crystal Diamond Vine Anti-Tarnish Necklace features sparkling clear white marquise CZ stones arranged in an elegant V… | 111 |
| `crystal stones` | stone | 1 | … your everyday look with this elegant thin band ring featuring tiny crystal stones. Designed for minimal lovers, this lightweight gold-finish ring pai… | 318 |
| `crystal-accented` | stone | 1 | …ld-plated copper, it features a shimmering cat’s eye stone bud and crystal-accented leaves. The adjustable pull-chain design ensures a perfect fit for… | 239 |
| `crystal-inspired` | stone | 1 | … a classic white dial with Roman numeral detailing and a beautiful crystal-inspired bracelet design. The combination of the elegant gold-tone finish, … | 479 |
| `crystal-lined` | stone | 1 | …nt featuring a textured sunburst medallion top, paired with a sleek crystal-lined bar for the key's shaft. The mix of hammered gold detailing and spar… | 445 |
| `Cubic zirconia crystals` | stone | 1 | …alloy Plating: High-shine silver / rhodium plating Stone Type: Cubic zirconia crystals Design: Adjustable stack-style star and crystal band set Size /… | 426 |
| `Cubic zirconia stones` | stone | 1 | …ngs. Material: Alloy base Plating: Rose gold plated Stone Type: Cubic zirconia stones Design: V-shaped crystal band ring Size / Fit: Free size – adjus… | 382 |
| `CZ stone-studded` | stone | 1 | …ove It: ✨ Charming twin rose design for a romantic touch ✨ Elegant CZ stone-studded cross bands for radiant sparkle ✨ Adjustable fit for maximum comfo… | 460 |
| `CZ Stones` | stone | 1 | …ur DC Jewelry Twin Heart Adjustable Ring – Rosegold Love Edition with CZ Stones — a charming symbol of elegance and grace. Whether it's a special cele… | 147 |
| `CZ-embellished` | stone | 1 | …alist Ring for Women . This contemporary open band features a sleek CZ-embellished bar paired with a polished pebble accent for a trendy, asymmetric l… | 77 |
| `CZ-encrusted` | stone | 1 | …ate pink & red meenakari square panels with pearl borders, a heavily CZ-encrusted dial, and a multicolour chand pendant with cascading ghungroo chains… | 290 |
| `diamond` | stone | 1 | …Featuring a beautifully textured, ribbed heart design with a sparkling diamond-like stone at its center, this anti-tarnish, 18K gold-plated necklace a… | 449 |
| `Diamond-cut` | stone | 1 | …ld tone plated Finish: Anti-tarnish – retains shine for long Design: Diamond-cut geometric pattern with sparkling stones Style: Minimalist, chic & ver… | 39 |
| `diamond-cut` | stone | 1 | … steel and plated in 18K gold tone, the sleek band features a unique diamond-cut pattern studded with brilliant stones that shine effortlessly with ev… | 39 |
| `diamond-like stone` | stone | 1 | …ring a beautifully textured, ribbed heart design with a sparkling diamond-like stone at its center, this anti-tarnish, 18K gold-plated necklace adds a… | 449 |
| `diamond-shaped` | stone | 1 | … cascading row of raised oval petals along the hoop with a standout diamond-shaped centrepiece at the base. A modern architectural design that brings … | 169 |
| `diamond-shaped green` | stone | 1 | …ply traditional — this charming Kashmiri bracelet watch features diamond-shaped green meenakari panels with hand-painted pink floral motifs and sparkl… | 285 |
| `Dual-tone multicolor` | plating | 1 | …tfit. Material: Premium Glass Work: Stone-studded design Colors: Dual-tone multicolor (Green, Yellow, Pink, Orange) Design: Stylish ethnic bangles wit… | 177 |
| `dual-tone multicolor glass` | material + plating | 1 | Description: Bring elegance to your ethnic look with these dual-tone multicolor glass bangles, beautifully studded with sparkling stones. Perfect for … | 177 |
| `Durable alloy` | material | 1 | …tacking and adds a luxurious sparkle to everyday outfits. Material: Durable alloy Plating: High-shine silver / rhodium plating Stone Type: Cubic zirco… | 426 |
| `durable anti-tarnish gold` | material | 1 | …terfly, a simple heart, and a floral-patterned disc, all on a durable anti-tarnish gold chain. Perfect for adding a fun, bohemian touch to your look. … | 329 |
| `durable anti-tarnish gold finish` | material + plating | 1 | …ent with this vibrant multi-color enamel kada. Featuring a durable anti-tarnish gold finish and elegant textured accents, this designer bangle is perf… | 330 |
| `durable finish Pastel green` | plating | 1 | …dian craftsmanship. Key Features: Premium glass bangles with durable finish Pastel green color with hand-embellished stone detailing Lightweight and c… | 339 |
| `durable gold` | material | 1 | …utfit. Perfect for everyday wear or layering. Shop our high-quality, durable gold jewelry online. Premium Quality \| Anti-Tarnish Base Material: Stainl… | 321 |
| `durable gold plating` | material + plating | 1 | …m to any look. Made from premium-quality alloy and finished with durable gold plating, the ring is lightweight, skin-friendly, and comfortable to wear… | 296 |
| `Durable gold-tone plating` | material + plating | 1 | …ul gift for loved ones. Material: High-quality alloy Plating: Durable gold-tone plating Stone Type: Rectangular green crystal zircon Design: Sleek bez… | 7 |
| `Durable high-quality alloy` | material | 1 | …t for fashion lovers Highlights / Specifications: 🔹 Material: Durable high-quality alloy 🔹 Plating: Premium gold plating for enhanced shine 🔹 Stone Ty… | 94 |
| `durable premium alloy` | material | 1 | …ing loved ones Highlights / Specifications: 🔹 Material: Strong, durable premium alloy 🔹 Plating: Timeless gold plating for lasting brilliance 🔹 Stone … | 370 |
| `Durable premium-quality alloy` | material | 1 | …ng someone special Highlights / Specifications: 🔹 Material: Durable premium-quality alloy 🔹 Plating: Luxurious gold plating for rich shine 🔹 Stone Typ… | 273 |
| `emerald crystal` | stone | 1 | Add a touch of enchantment to your style with this emerald crystal vine necklace. Featuring a vibrant green oval centerpiece flanked by shimmering cry… | 224 |
| `Emerald Green` | stone | 1 | … Set Includes: 12 Glass Bangles Material: High-quality glass Color: Emerald Green Design: Golden dotted detailing Finish: Smooth & glossy glass finish… | 195 |
| `emerald green CZ stones` | stone | 1 | …h coating — stays shine-fresh longer 💙 Vibrant sapphire blue & emerald green CZ stones 🌿 Delicate leaf vine design — lightweight and comfortable 🔒 Sec… | 86 |
| `Emerald Stone` | stone | 1 | …ause" surprise. What's Inside: Gold-Tone Rope Chain Bracelet Ruby & Emerald Stone Necklace Gold-Tone Twisted Hoop Earrings Satin Scrunchie – Rose Gold… | 80 |
| `emerald-colored stones` | stone | 1 | …his stunning gold-toned nath, intricately studded with ruby and emerald-colored stones. A perfect high-fashion accessory for festive occasions. To ens… | 242 |
| `emerald-cut` | stone | 1 | …Silver-Plated Ring for Women . This dazzling ring features two large emerald-cut CZ stones, framed with brilliant halos for a luxurious finish. Design… | 173 |
| `Emerald-cut amethyst-purple` | stone | 1 | …d-plated stainless steel, tarnish and water resistant Stone: Emerald-cut amethyst-purple center stone, clear crystal leaf accents Chain: Snake chain, … | 486 |
| `emerald-cut clear crystal` | stone | 1 | A timeless emerald-cut clear crystal pendant, set in a classic four-prong gold mounting for a look that's clean, sparkling, and endlessly versatile. T… | 100 |
| `Emerald-cut clear cubic zirconia` | stone | 1 | …plated stainless steel, tarnish and water resistant Stone: Emerald-cut clear cubic zirconia, four-prong gold setting Chain: Fine link chain, adjustabl… | 100 |
| `Emerald-cut cubic zirconia` | stone | 1 | …ng: Lustrous silver plating for a dazzling look 🔹 Stone Type: Emerald-cut cubic zirconia with halo accent stones 🔹 Design: Double twin rectangular sol… | 173 |
| `emerald-cut CZ stones` | stone | 1 | …r-Plated Ring for Women . This dazzling ring features two large emerald-cut CZ stones, framed with brilliant halos for a luxurious finish. Designed to… | 173 |
| `emerald-green crystal base` | stone | 1 | …rms, each set with a vibrant fuchsia-pink crystal petal and a emerald-green crystal base, finished with sparkling clear crystal spacers along the chai… | 240 |
| `Emerald-green cubic zirconia` | stone | 1 | …d-plated stainless steel, tarnish and water resistant Stone: Emerald-green cubic zirconia Chain: Adjustable snake chain Pendant size: Approx. 1x1cm di… | 227 |
| `emerald-green cubic zirconia` | stone | 1 | … stainless steel, tarnish and water resistant Stone: Faceted emerald-green cubic zirconia, beaded gold bezel setting Chain: Fine link chain, adjustabl… | 265 |
| `emerald-green stones` | stone | 1 | A delicate circle of gold hearts and sparkling emerald-green stones, linked together to form a beautiful wreath pendant. Crafted in 18K gold-plated st… | 227 |
| `enamel finish` | material + plating | 1 | … water-resistant piece is designed for everyday luxury. Its vibrant enamel finish and modern silhouette ensure your style remains bold and brilliant t… | 50 |
| `enamel quality` | material | 1 | …nd indo-western outfits. Also stunning with boho western looks. Avoid contact with water, perfume, and chemicals to maintain shine and enamel quality. | 336 |
| `Fabric` | material | 1 | …– Pink Stone Kashmiri Watch Jewellery Set – Traditional Gold-Tone Satin Fabric Rose Hair Clip – Ivory Marble-Effect Flower Hair Claw Clips (Set of 2 –… | 308 |
| `Faux pearl` | stone | 1 | …ial: High-quality alloy base Plating: Premium gold plated Stone Type: Faux pearl + cubic zirconia Design: Open adjustable ring with floral and star mo… | 316 |
| `faux pearls` | stone | 1 | Effortlessly elegant, our Pearl Station Necklace features lustrous faux pearls delicately spaced along a shimmering gold-toned chain. This timeless fa… | 343 |
| `fine crystal` | stone | 1 | A charming heart-shaped bracelet with fine crystal accents, designed to add a soft, romantic glow to your look. Lightweight and stylish, it’s perfect … | 183 |
| `fine gold plating` | material + plating | 1 | …ith this Initial Letter Ring! Crafted on premium brass metal with fine gold plating, it delivers the shine and elegance of real gold jewellery. Featur… | 92 |
| `Fine stainless-steel-style` | material | 1 | … 🤍 Anti-tarnish silver-tone finish 💙 Elegant aqua blue dial 🔗 Fine stainless-steel-style mesh bracelet 🎀 Unique bow-inspired detailing around the dial… | 482 |
| `Finished` | plating | 1 | …l beads and a sparkling star motif with premium cubic zirconia stones. Finished in smooth gold plating, it brings a minimal yet stylish charm—perfect … | 316 |
| `genuine pearl` | stone | 1 | …ing for luxurious shine 🔹 Stone Type: Sparkling cubic zirconia with genuine pearl accent 🔹 Design: Contemporary open-band with bar and pearl elements … | 342 |
| `Glossy gold plating` | material + plating | 1 | …fications: 🔹 Material: Durable, premium-quality alloy 🔹 Plating: Glossy gold plating for a luxurious touch 🔹 Stone Type: Sparkling baguette-cut cubic … | 371 |
| `Glossy Stainless Steel` | material | 1 | 1pc Korean Fashion Minimalist Glossy Stainless Steel Moebius Ring Bracelet, Exquisite Fine Chain, Perfect for Daily Wear, Ideal Gift for Relatives and… | 320 |
| `Gold finish` | material + plating | 1 | …ents both ethnic and western outfits. Material: Alloy metal Plating: Gold finish Stone Type: Pave-set cubic zirconia Design: Rope-style band with crys… | 380 |
| `Gold Green` | material | 1 | Give your everyday look a sophisticated upgrade with this Vintage Gold Green Square Dial Mesh Bracelet Watch , featuring a rich green dial, elegant de… | 483 |
| `Gold Plated Stainless Steel` | material + plating | 1 | This Gold Plated Stainless Steel Anti Tarnish Multicolor Adjustable Finger Ring For Women balances design, versatility, and craftsmanship, making it a… | 21 |
| `Gold Polished` | material | 1 | … Comfortable for daily wear A lovely gift for her Details: Plating: Gold Polished Material: Brass Stones: American Diamonds Care: Avoid moisture & che… | 126 |
| `Gold tones` | material + plating | 1 | …Material: Premium quality glass Color: Multicolor (Blue, Pink, Green, Gold tones) Design: Elegant golden dotted detailing Finish: Smooth, glossy glass… | 404 |
| `gold tones` | material + plating | 1 | …y with sarees, lehengas, and ethnic outfits in cream, green, red, and gold tones. Whether worn alone for a refined look or stacked with complementary … | 333 |
| `gold-detailed` | material | 1 | …nter, these earrings radiate feminine charm and sophistication. The gold-detailed edges enhance the luxurious look, making them perfect for both casua… | 256 |
| `gold-finish` | material + plating | 1 | …g tiny crystal stones. Designed for minimal lovers, this lightweight gold-finish ring pairs beautifully with all outfits. ✨ Slim & Stylish Design ✨ Sp… | 318 |
| `gold-leaf` | material | 1 | …his blush pink floral kada. Featuring delicate red flower accents and gold-leaf engravings, this anti-tarnish bangle offers a vintage-inspired aesthet… | 88 |
| `gold-plated base` | material + plating | 1 | …th curves shimmer with premium zircon stones, beautifully set on a gold-plated base for a luxurious finish. Lightweight, durable, and handmade with ca… | 68 |
| `gold-plated crystal` | material + plating + stone | 1 | … yet eye-catching glow. Keywords included: pink flower earrings, gold-plated crystal studs, floral earrings for women, pastel pink stone earrings, lig… | 256 |
| `gold-plated CZ` | material + plating + stone | 1 | Some gestures say more when they sparkle. This gold-plated CZ ring spells out love with cubic zirconia stones set in a delicate message band, designed… | 2 |
| `gold-plated mint green` | material + plating | 1 | …ing pop of color to your jewelry collection with these stunning gold-plated mint green floral stud earrings . Designed with soft mint stones arranged … | 252 |
| `gold-plated multicolor` | material + plating | 1 | …uch of charm and sophistication to your look with this stunning gold-plated multicolor drop necklace . Designed with alternating red, green, and pearl… | 255 |
| `gold-plated pink crystal` | material + plating + stone | 1 | …legance and sparkle to your everyday style with these stunning gold-plated pink crystal flower stud earrings . Featuring six faceted petal stones in a… | 256 |
| `gold-plated round` | material + plating | 1 | Elevate your everyday elegance with these stunning gold-plated round stud earrings , designed with a unique square shimmer stone at the center. Surrou… | 257 |
| `gold-tone glass` | material + plating | 1 | Elevate your ethnic and festive look with this exquisite gold-tone glass bangles set , crafted to bring timeless elegance and royal charm to your jewe… | 263 |
| `Gold-Tone Textured` | material + plating | 1 | … all. What's Inside: Gold-Tone Stud & Hoop Earrings Set (6 Pairs) Gold-Tone Textured Hoop Earrings Peach & Pearl Beaded Flower Charm Bracelet Gold-Ton… | 270 |
| `Gold-toned` | material + plating | 1 | Product Details Gold-toned chain Material and stone type: alloy Size & Fit Chain Length:45 cm + 5 cm Pendant:2 cm x 2 cm (Length x Width) Material & C… | 274 |
| `gold-toned stainless steel` | material + plating | 1 | Add a modern edge to your look with these gold-toned stainless steel hoops, featuring a chic embossed pattern. These high-fashion earrings provide an … | 437 |
| `gold-toned stainless steel textured` | material + plating | 1 | Elevate your everyday style with these stunning gold-toned stainless steel textured hoops. Their unique ribbed design offers a bold, modern twist on a… | 440 |
| `gold-toned white stone` | material + plating + stone | 1 | Radiate elegance with this exquisite gold-toned white stone nath. This high-fashion accessory features a delicate drop design, perfect for weddings an… | 250 |
| `Golden stone-studded` | material + stone | 1 | …ies, or everyday ethnic wear. Material: High-quality Glass Work: Golden stone-studded floral design Color: Transparent with golden detailing Design: S… | 457 |
| `golden tones` | material + plating | 1 | …end of rich hues including royal blue, deep pink, emerald green, and golden tones , these bangles instantly elevate any traditional outfit. Each bangl… | 404 |
| `golden-toned` | material + plating | 1 | A warm, golden-toned gift hamper made to celebrate real friendship. Packed in a white gift box with a "Best Friends Forever" ribbon and a heartfelt "H… | 270 |
| `golden-yellow tone` | material + plating | 1 | … elegant set of 12 mustard yellow glass bangles. Featuring a rich golden-yellow tone enhanced with delicate gold bead detailing and a soft shimmer, th… | 333 |
| `green crystal` | stone | 1 | …ound dial and artistic oval-link bracelet embellished with matching green crystal studs give it a refined, jewellery-like appearance, making it perfec… | 476 |
| `green crystal zircon` | stone | 1 | …alloy Plating: Durable gold-tone plating Stone Type: Rectangular green crystal zircon Design: Sleek bezel-set solitaire design Size & Fit: Adjustable,… | 7 |
| `green crystals` | stone | 1 | …ollarbone. The alternating pattern of polished gold hearts and rich green crystals adds a touch of color and romance to everyday layering, while the t… | 227 |
| `green cubic zirconia` | stone | 1 | …ted stainless steel, tarnish and water resistant Stone: Pink and green cubic zirconia tulip charms, clear crystal spacers Chain: Fine link chain with … | 240 |
| `green CZ` | stone | 1 | …s charming bracelet features delicate pink tulip charms with sparkling green CZ leaves set on a dainty gold chain with gold bead accents. Feminine, fr… | 23 |
| `Green gemstone` | stone | 1 | Elegant Green gemstone statement ring Premium silver-finish with classic detailing Minimal yet bold design for effortless styling Lightweight & comfor… | 269 |
| `green tone` | plating | 1 | …shine and ensures comfortable wear throughout the day. The refreshing green tone makes this set an excellent choice for festive occasions, weddings, p… | 303 |
| `green tones` | plating | 1 | …r that catches the light beautifully. The harmonious blend of earthy green tones and gold accents makes this bangle set a versatile choice for festive… | 406 |
| `grey glass` | material | 1 | Elevate your ethnic grace with this stunning set of 12 grey glass bangles and 4 golden ghoonghroo bangles. This fashionable ensemble adds a melodic ch… | 97 |
| `High-quality alloy` | material | 1 | …wear, parties, and as a thoughtful gift for loved ones. Material: High-quality alloy Plating: Durable gold-tone plating Stone Type: Rectangular green … | 7 |
| `High-quality alloy base` | material | 1 | …erfect for daily wear or gifting to someone special. Material: High-quality alloy base Plating: Premium gold plated Stone Type: Faux pearl + cubic zir… | 316 |
| `High-quality anti-tarnish metal` | material | 1 | …igns and colors to match every outfit. Features: Material: High-quality anti-tarnish metal Design: Openable clasp for ease of wear Finish: Long-lastin… | 19 |
| `High-quality cubic zirconia` | stone | 1 | …: Rich gold plating ensures long-lasting shine 🔹 Stone Type: High-quality cubic zirconia accents 🔹 Design: Stylish bow knot with layered band structur… | 90 |
| `high-quality cubic zirconia stones` | stone | 1 | … gold plating for lasting brilliance 🔹 Stone Type: Clear, high-quality cubic zirconia stones 🔹 Design: Rectangle multi-row band with pavé setting 🔹 Si… | 370 |
| `high-quality CZ stones` | stone | 1 | …—princess-cut & floral—on a single ring ✨ Gorgeous sparkle with high-quality CZ stones ✨ Easy-to-adjust for comfortable, secure fit ✨ Perfect for dail… | 176 |
| `High-quality durable alloy` | material | 1 | …d everyday occasions Highlights / Specifications: 🔹 Material: High-quality durable alloy 🔹 Plating: Luminous gold plating for long-lasting shine 🔹 Sto… | 278 |
| `High-quality Glass` | material | 1 | … weddings, festivals, parties, or everyday ethnic wear. Material: High-quality Glass Work: Golden stone-studded floral design Color: Transparent with … | 457 |
| `High-quality princess-cut cubic zirconia` | stone | 1 | …Brilliant gold plating for lasting shine 🔹 Stone Type: High-quality princess-cut cubic zirconia 🔹 Design: Elegant solitaire style with a refined finis… | 185 |
| `imitation pearl` | stone | 1 | Embrace a sweet, minimalist look with this baroque imitation pearl bracelet. Featuring a unique tulip-themed OT toggle clasp, this elegant piece is de… | 78 |
| `Ivory Acrylic` | material | 1 | … Charm Bracelet Gold-Tone Twisted Ring Satin Fabric Rose Hair Tie – Ivory Acrylic Flower Hair Claw Clip – Yellow Why She'll Love It: A complete jewell… | 270 |
| `ivory white glass` | material | 1 | …elegance to your jewelry collection with this exquisite set of 12 ivory white glass bangles. Featuring a soft, classic white tone beautifully accented… | 283 |
| `jewel-toned` | plating | 1 | …n gives the necklace a botanical, nature-inspired feel with a pop of jewel-toned color. Crafted in 18K gold-plated stainless steel, it's tarnish and w… | 240 |
| `Kundan Stones` | stone | 1 | …h Material: Alloy Finish: Antique Gold Design: Green Meenakari with Kundan Stones Stone Type: Kundan & Crystal Stones Dial Shape: Round Closure: Adjus… | 267 |
| `lavender purple CZ stones` | stone | 1 | …ring a stunning mix of ruby red, sky blue, emerald green, and lavender purple CZ stones set along a flowing vine design. Bold, colourful, and full of … | 332 |
| `lavender purple oval CZ` | stone | 1 | … to any outfit. 💛 Gold-plated with anti-tarnish coating 💜 Soft lavender purple oval CZ + emerald green leaf stones 🌿 V-shaped vine pendant — light and… | 363 |
| `Maroon gemstone` | stone | 1 | Elegant Maroon gemstone statement ring Premium silver-finish with classic detailing Minimal yet bold design for effortless styling Lightweight & comfo… | 484 |
| `maroon glass` | material | 1 | Enrich your ethnic look with this striking set of 12 maroon glass bangles and 4 golden ghoonghroo bangles. This fashionable ensemble adds a beautiful … | 390 |
| `marquise CZ stones` | stone | 1 | … a delicate gold-plated bracelet adorned with blush pink oval and marquise CZ stones set along a flowing vine design. Feminine, lightweight, and effor… | 354 |
| `marquise-cut crystals` | stone | 1 | …ng a dainty gold-toned chain and a brilliant vine of shimmering marquise-cut crystals, this anti-tarnish piece offers a high-end, sophisticated sparkl… | 218 |
| `marquise-cut cubic zirconia` | stone | 1 | … gold plating for long-lasting shine 🔹 Stone Type: Sparkling marquise-cut cubic zirconia 🔹 Design: Leaf-inspired band with centerpiece stone 🔹 Size/Fi… | 300 |
| `mint green stones` | stone | 1 | …contemporary look. mint choker set, CZ necklace set, bridal jewelry, party wear jewelry, silver-plated choker, mint green stones, festive jewelry set. | 325 |
| `Mother-of-pearl` | stone | 1 | …8K gold-plated stainless steel, tarnish and water resistant Stone: Mother-of-pearl center, clear crystal border accents Chain: Fine link chain, adjust… | 327 |
| `mother-of-pearl` | stone | 1 | …on framed with sparkling crystal edges, centered around a luminous mother-of-pearl disc and finished with a small gold star accent. The soft, iridesce… | 327 |
| `multi-color enamel` | material | 1 | Make a statement with this vibrant multi-color enamel kada. Featuring a durable anti-tarnish gold finish and elegant textured accents, this designer b… | 330 |
| `Multi-stone` | stone | 1 | …Gold-plated with anti-tarnish coating — stays bright and beautiful 🌈 Multi-stone design — red, blue, green & purple CZ stones 🌿 Flowing vine silhouett… | 332 |
| `multicolor crystal` | stone | 1 | Brighten up your look with these stunning multicolor crystal cluster stud earrings , crafted with a luxurious gold-plated finish. Featuring a vibrant … | 331 |
| `Multicolor Gemstone` | stone | 1 | …rise. What's Inside: Ruby & Crystal Pendant Necklace (Gold Tone) Multicolor Gemstone tulip Bracelet Gold-Tone Charm anklet– Star & Flower Charms Perso… | 165 |
| `Multicolor glass` | material | 1 | … festive accessories, or gifting to someone special. Key Features: Multicolor glass bangles with shimmering crystal accents Handcrafted for superior q… | 401 |
| `multicolor tones` | plating | 1 | …fting. Key Features: Artistic wave-shaped glass bangles in vibrant multicolor tones Unique contemporary silhouette with high-gloss finish Handcrafted … | 461 |
| `multicolour kundan` | stone | 1 | …stone-encrusted dial that dazzles from every angle. Below flows a multicolour kundan chand pendant with cascading triple ghungroo chains — dramatic, r… | 291 |
| `navy blue glass` | material | 1 | Add refined elegance to your ethnic style with this beautiful navy blue glass bangles set , featuring 12 finely crafted bangles designed to create a r… | 334 |
| `navy blue stone` | stone | 1 | …lue and crystal floral stud earrings . Featuring a cluster of deep navy blue stones paired with sparkling cubic zirconia, these earrings create a radi… | 419 |
| `navy blue stones` | stone | 1 | …lue and crystal floral stud earrings . Featuring a cluster of deep navy blue stones paired with sparkling cubic zirconia, these earrings create a radi… | 419 |
| `navy blue tone` | plating | 1 | …s offer a perfect balance of tradition and sophistication. The deep navy blue tone paired with subtle gold detailing makes this set a versatile choice… | 334 |
| `ombre enamel` | material | 1 | Elevate your accessory game with this premium neutral ombre enamel kada, Featuring a high-quality gold-plated finish, its anti-tarnish and water-resis… | 53 |
| `Orange Enamel` | material | 1 | Bold, beautiful, and uniquely Indian — our Orange Enamel Floral Vine Kada Bracelet features a wide dome-shaped gold-plated bangle with a rich orange e… | 336 |
| `orange glass` | material | 1 | …vibrance to your jewelry collection with this elegant set of 12 rust orange glass bangles. Featuring a rich, earthy orange tone with fine gold bead em… | 393 |
| `orange tone` | plating | 1 | …legant set of 12 rust orange glass bangles. Featuring a rich, earthy orange tone with fine gold bead embellishments, this bangle set offers a perfect … | 393 |
| `Oval American Diamond` | stone | 1 | …ial: Brass base Plating: Premium Gold-plated finish Stone Type: Oval American Diamond (AD) with side stones Design: Solitaire-inspired with slim studd… | 386 |
| `oval American Diamond stone` | stone | 1 | … gold-plated adjustable solitaire ring , featuring a radiant oval American Diamond stone complemented by a delicate studded band. Perfect for daily we… | 386 |
| `pastel green glass` | material | 1 | …escription: Add a touch of elegance to your ethnic look with this pastel green glass bangle set delicately embellished with sparkling stones. Designed… | 339 |
| `pastel pink marquise-cut stones` | stone | 1 | …tailed teardrop frame. The lower section features multiple pastel pink marquise-cut stones arranged in an elegant, airy pattern, bordered by shimmerin… | 425 |
| `pastel pink stone` | stone | 1 | …wer earrings, gold-plated crystal studs, floral earrings for women, pastel pink stone earrings, lightweight daily wear jewelry, festive stud earrings. | 256 |
| `pastel stone` | stone | 1 | …. pink drop earrings, silver-plated earrings, CZ earrings for women, pastel stone earrings, marquise cut earrings, party wear jewelry, elegant stateme… | 425 |
| `pastel-toned` | plating | 1 | A dreamy pastel-toned hamper made for your favourite person — perfect for Friendship Day, birthdays, or just to say "you are my best friend." Comes wi… | 207 |
| `Peach Orange Acrylic` | material | 1 | …d Flower Charm Bracelet Gold-Tone Twisted Ring Satin Scrunchie – Peach Orange Acrylic Flower Hair Claw Clip Why She'll Love It: A complete jewellery s… | 207 |
| `pearl-accented` | stone | 1 | …g a classic white dial, elegant gold-tone detailing and a beautiful pearl-accented bracelet. The unique leaf-shaped oval dial gives the watch a distin… | 480 |
| `pearl-bordered white quartz` | stone | 1 | …ellow lotus flower charms with green leaf accents flanking a pearl-bordered white quartz dial, leading to an adorable green meenakari elephant pendant… | 294 |
| `Pearl-detail` | stone | 1 | …watch 💛 Anti-tarnish gold-tone finish 💚 Elegant emerald green dial 🤍 Pearl-detail bracelet design 🌿 Unique leaf-shaped dial ⌚ Quartz movement 🔗 Stylis… | 475 |
| `pearl-detail` | stone | 1 | …acelet Watch , featuring a beautiful emerald green dial and a unique pearl-detail chain bracelet. The elegant combination of gold, green and pearl acc… | 475 |
| `pearl-drop` | stone | 1 | …, flanking a unique square star-dial quartz watch face. An adjustable pearl-drop slider chain with ghungroo bells ensures a perfect fit on every wrist… | 286 |
| `pearl-like` | stone | 1 | …ce with our exquisite Heart Pendant Necklace. Featuring a shimmering, pearl-like heart centerpiece on a polished gold-toned link chain, this piece is … | 328 |
| `Pearl-style` | stone | 1 | …ld-tone finish 🤍 Elegant white dial 🌿 Unique leaf-shaped oval dial 🤍 Pearl-style detailing on the bracelet 🔗 Stylish statement chain bracelet ⌚ Quartz… | 480 |
| `pearl-style` | stone | 1 | …dial gives the watch a distinctive vintage charm, while the delicate pearl-style detailing throughout the bracelet creates a sophisticated jewellery-i… | 480 |
| `pearl-toned` | plating + stone | 1 | …multicolor drop necklace . Designed with alternating red, green, and pearl-toned drops, this piece brings together vibrant color and refined elegance.… | 255 |
| `pearlescent` | stone | 1 | … of spring with this elegant white enamel flower necklace. Featuring pearlescent petals and a detailed gold-toned center, this anti-tarnish pendant ha… | 491 |
| `pearlescent white quartz` | stone | 1 | …ple gold chains with jingling ghungroo bells on both ends. The pearlescent white quartz dial adds a regal finishing touch. A true showstopper for brid… | 287 |
| `Pearls` | stone | 1 | …:2 cm x 2 cm (Length x Width) Material & Care Material:Alloy Stone type:Pearls Care Instructions: Wipe your jewellery with a soft cloth after every us… | 274 |
| `pink crystal stones` | stone | 1 | Elegant anti tarnish bracelet with blush pink crystal stones and a delicate gold vine design. Lightweight, stylish, and perfect for daily wear or gift… | 87 |
| `pink CZ stones` | stone | 1 | …-plated with anti-tarnish coating — long-lasting shine 🌸 Soft blush pink CZ stones — oval + marquise cut 🌿 Flowing vine design — graceful and lightwei… | 354 |
| `Pink glass` | material | 1 | Description: Make a bold statement with this radiant set of Pink glass bangles , beautifully adorned with shimmering golden bead accents. Crafted from… | 351 |
| `pink oval CZ` | stone | 1 | …r Pink Rose & Emerald Vine Anti-Tarnish Necklace features soft blush pink oval CZ stones nestled between lush emerald green leaf accents on a gold-pla… | 353 |
| `pink oval CZ stones` | stone | 1 | …nk Rose & Emerald Vine Anti-Tarnish Necklace features soft blush pink oval CZ stones nestled between lush emerald green leaf accents on a gold-plated … | 353 |
| `Pink Stone` | stone | 1 | …rm Bracelets (Set of 2 – Floral Design) D'Pary Kundan Drop Earrings – Pink Stone Kashmiri Watch Jewellery Set – Traditional Gold-Tone Satin Fabric Ros… | 308 |
| `pink stones` | stone | 1 | … The matching earrings complement the necklace with the same vibrant pink stones, offering a coordinated and classy look. Lightweight, comfortable, an… | 346 |
| `pink tones` | plating | 1 | …r elevating an everyday look with a touch of sophistication. The soft pink tones paired with the high-polish silver finish create a chic and feminine … | 425 |
| `pink zircon stones` | stone | 1 | …is beautiful pink CZ tennis necklace set , crafted with sparkling pink zircon stones set in a sleek silver-plated finish. The necklace features a refi… | 346 |
| `plating` | plating | 1 | …his Initial Letter Ring! Crafted on premium brass metal with fine gold plating, it delivers the shine and elegance of real gold jewellery. Features: L… | 92 |
| `polished finish` | plating | 1 | …inspired appearance, while the fine mesh strap adds a delicate and polished finish. Its versatile design makes it perfect for styling with both wester… | 483 |
| `polished gold finish` | material + plating | 1 | …tal. Premium Gold Plating – Crafted from high-quality alloy with polished gold finish for lasting shine. Adjustable Fit – Flexible band fits comfortab… | 296 |
| `polished gold-tone` | material + plating | 1 | …a sleek white oval dial and a unique bracelet made with oversized polished gold-tone beads. Its distinctive design beautifully combines the look of a … | 469 |
| `polished golden` | material | 1 | …bracelet strap. The deep green dial beautifully contrasts with the polished golden cross-bezel finish, creating a sophisticated vintage-inspired look.… | 470 |
| `polki kundan` | stone | 1 | …bracelet watch features deep royal blue meenakari floral charms with polki kundan centres, flanking a heavily CZ stone-encrusted watch dial that shine… | 284 |
| `Premium Alloy` | material | 1 | … Details: • Design: Knot / Twist Design • Color: Silver • Material: Premium Alloy • Size: Adjustable (Fits most finger sizes) • Style: Minimal \| Elega… | 190 |
| `premium alloy` | material | 1 | …t for any occasion Highlights / Specifications: 🔹 Material: Sturdy, premium alloy for durability 🔹 Plating: Radiant gold plating for lasting shine 🔹 S… | 388 |
| `premium anti-tarnish finish` | plating | 1 | Elegant pastel floral bracelet with premium anti-tarnish finish. Lightweight, stylish & perfect for daily wear. 📦 Comes without box | 338 |
| `premium anti-tarnish gold base` | material | 1 | … are complemented by deep blue floral centers, all set on a premium anti-tarnish gold base. This high-quality bangle provides a refreshing pop of colo… | 74 |
| `premium anti-tarnish gold finish` | material + plating | 1 | …wrist with this stunning green enamel kada. Crafted with a premium anti-tarnish gold finish, it offers long-lasting shine and durability. Perfect for … | 182 |
| `premium anti-tarnish stainless steel` | material | 1 | …th our elegant North Star pendant necklace. Crafted from premium anti-tarnish stainless steel with 18K gold plating, this minimalist rectangle charm a… | 321 |
| `premium antique gold finish` | material + plating | 1 | … ghungroo charms, and graceful chain tassels. Crafted with a premium antique gold finish, this bracelet watch blends timeless Indian craftsmanship wit… | 374 |
| `premium black enamel` | material | 1 | Define sophistication with this premium black enamel kada featuring a classic Greek key motif. Expertly crafted with a high-quality gold finish, its a… | 30 |
| `premium blue diamond-pattern enamel` | material + stone | 1 | Elevate your style with this premium blue diamond-pattern enamel kada. Expertly crafted with a high-quality gold finish, its anti-tarnish and water-re… | 32 |
| `premium blue ombre enamel` | material | 1 | Dive into elegance with this premium blue ombre enamel kada. Crafted with a high-quality gold-plated finish, its anti-tarnish and water-resistant prop… | 33 |
| `premium blue ombre textured enamel` | material | 1 | Dive into luxury with this premium blue ombre textured enamel kada. Expertly crafted with a high-quality gold finish, its anti-tarnish and water-resis… | 34 |
| `premium brass metal` | material | 1 | …al touch to your style with this Initial Letter Ring! Crafted on premium brass metal with fine gold plating, it delivers the shine and elegance of rea… | 92 |
| `premium cubic zirconia stones` | stone | 1 | …er made of mini pearl beads and a sparkling star motif with premium cubic zirconia stones. Finished in smooth gold plating, it brings a minimal yet st… | 316 |
| `Premium emerald green glass` | material + stone | 1 | …le set is a must-have for every jewelry lover. Key Features: Premium emerald green glass bangles with golden bead detailing Traditional handcrafted fi… | 268 |
| `Premium Gold Finish` | material + plating | 1 | …fortable, it adds a trendy touch to any outfit. ✨ Adjustable Size ✨ Premium Gold Finish ✨ Lightweight & Skin-Friendly ✨ Ideal for Daily Wear & Gifting | 319 |
| `premium gold finish` | material + plating | 1 | …nspired by Korean fashion. Featuring a delicate dial look with a premium gold finish, this adjustable ring is perfect for daily wear and casual outing… | 319 |
| `Premium gold plated` | material + plating | 1 | …g to someone special. Material: High-quality alloy base Plating: Premium gold plated Stone Type: Faux pearl + cubic zirconia Design: Open adjustable r… | 316 |
| `Premium Gold Plating` | material + plating | 1 | …– Minimalist square-cut solitaire with a sparkling pink crystal. Premium Gold Plating – Crafted from high-quality alloy with polished gold finish for … | 296 |
| `Premium gold-plated finish` | material + plating | 1 | …for women who love classic jewelry-inspired watches. Features Premium gold-plated finish Handcrafted Meenakari floral design Elegant ghungroo charm de… | 453 |
| `premium gold-plated finish` | material + plating | 1 | …acelet Watch , featuring delicate floral meenakari artwork, a premium gold-plated finish, and charming ghungroo accents. Designed to resemble a beauti… | 453 |
| `premium gold-tone finish` | material + plating | 1 | …nd elegant occasions. Lightweight, durable, and crafted with a premium gold-tone finish, this necklace sits comfortably on the neckline and pairs effo… | 249 |
| `Premium gold-tone metal alloy` | material + plating | 1 | …kes moments memorable Highlights & Specifications Material: Premium gold-tone metal alloy Plating: High-quality gold plating for enduring shine Stone … | 179 |
| `premium gold-toned` | material + plating | 1 | …e vibrant crimson bud and lustrous green leaves are set against a premium gold-toned chain, offering a bold yet classic floral aesthetic. This durable… | 372 |
| `premium green ombre enamel` | material | 1 | Refresh your style with this premium green ombre enamel kada. Featuring high-quality gold plating, its anti-tarnish and water-resistant properties ens… | 42 |
| `Premium high-quality alloy` | material | 1 | …ies, or celebrations Highlights / Specifications: 🔹 Material: Premium high-quality alloy 🔹 Plating: Lustrous silver plating for a dazzling look 🔹 Ston… | 173 |
| `premium Kundan stones` | stone | 1 | …ndan choker necklace set . Designed with intricate enamel work, premium Kundan stones, and lustrous pearl drops, this jewelry set combines tradition w… | 266 |
| `premium multi-color textured enamel` | material | 1 | Enhance your collection with this premium multi-color textured enamel kada. Crafted with high-quality gold plating, its anti-tarnish and water-resista… | 52 |
| `premium pink diamond-pattern enamel` | material + stone | 1 | Elevate your style with this premium pink diamond-pattern enamel kada. Expertly crafted with a high-quality gold finish, its anti-tarnish and water-re… | 59 |
| `premium pink ombre enamel` | material | 1 | Brighten your style with this premium pink ombre enamel kada. Featuring a high-quality gold-plated finish, its anti-tarnish and water-resistant proper… | 60 |
| `Premium quality glass` | material | 1 | …weddings, and special occasions . Product Highlights: Material: Premium quality glass Color: Multicolor (Blue, Pink, Green, Gold tones) Design: Elegan… | 404 |
| `premium silver finish` | material + plating | 1 | …uble-rectangle stone ring. Designed with a sleek open style and premium silver finish, this adjustable ring offers a classy and minimalist look for ev… | 175 |
| `Premium Silver Plating` | material + plating | 1 | …and minimalist look for everyday and party wear. ✨ Open Adjustable Design ✨ Premium Silver Plating ✨ Lightweight & Comfortable ✨ Stylish & Modern Look | 175 |
| `Premium silver plating` | material + plating | 1 | …cifications: 🔹 Material: High-quality, durable alloy 🔹 Plating: Premium silver plating for elegant shine 🔹 Stone Type: Sparkling cubic zirconia on one… | 171 |
| `premium silver plating` | material + plating | 1 | …eddings, parties, festive events, and bridal wear. Crafted with premium silver plating and high-shine stones, this jewelry set sits comfortably on the… | 325 |
| `Premium silver-tone finish` | material + plating | 1 | …bracelet watch adds a luxurious touch to any outfit. Features Premium silver-tone finish Sparkling crystal-studded floral dial Baguette-cut crystal br… | 310 |
| `premium silver-tone finish` | material + plating | 1 | …h , crafted with a dazzling crystal-studded floral dial and a premium silver-tone finish. The sparkling baguette-cut crystal bracelet and adjustable s… | 310 |
| `Premium stainless steel` | material | 1 | …ion. Product: Anti-Tarnish Crystal Cut-Out Band Ring Material: Premium stainless steel Plating: 18K gold tone plated Finish: Anti-tarnish for long-las… | 40 |
| `Premium sturdy alloy` | material | 1 | …or as a thoughtful gift Highlights / Specifications: 🔹 Material: Premium sturdy alloy for lasting beauty 🔹 Plating: Rich gold plating for an exquisite… | 208 |
| `premium white pearl` | stone | 1 | …aditional Rajasthani Pearl Beaded Bracelet Watch . Designed with premium white pearl beads, vibrant pink & green accents, and intricate meenakari-insp… | 455 |
| `premium yellow enamel` | material | 1 | Brighten your ensemble with this premium yellow enamel kada featuring a central pearl accent. Expertly crafted with a high-quality gold finish, its an… | 71 |
| `Premium-quality glass` | material | 1 | …ng it a versatile accessory for any festive look. Key Features: Premium-quality glass with durable finish Mustard yellow color with stone embellishmen… | 335 |
| `Princess-cut cubic zirconia stones` | stone | 1 | … Lustrous gold plating for lasting radiance 🔹 Stone Type: Princess-cut cubic zirconia stones 🔹 Design: Modern rectangular bar with five sparkling ston… | 361 |
| `princess-cut CZ stones` | stone | 1 | …ng features a sleek rectangular bar adorned with five sparkling princess-cut CZ stones, set in a rich gold-plated frame. Perfect for adding chic sophi… | 361 |
| `purple CZ stones` | stone | 1 | … a stunning mix of ruby red, sky blue, emerald green, and lavender purple CZ stones set along a flowing vine design. Bold, colourful, and full of pers… | 332 |
| `purple emerald-cut` | stone | 1 | A statement pendant featuring a deep purple emerald-cut center stone, surrounded by a cascading halo of clear crystal leaves for an art deco, vintage-… | 486 |
| `Purple enamel` | material | 1 | …8K gold-plated stainless steel, tarnish and water resistant Design: Purple enamel flower pendant, painterly finish Chain: Fine link chain, adjustable … | 366 |
| `Quality alloy` | material | 1 | …ll with casual and festive outfits alike. Product Details Material: Quality alloy Plating: Gold-tone, tarnish-resistant finish Stone: Cubic Zirconia F… | 2 |
| `quality alloy` | material | 1 | … for women who wear their heart with quiet confidence. Crafted from quality alloy with a gold-plated finish, the band features brilliant CZ stones arr… | 2 |
| `quartz` | stone | 1 | … bordered with delicate seed pearls, flanking a unique square star-dial quartz watch face. An adjustable pearl-drop slider chain with ghungroo bells e… | 286 |
| `real gold` | material | 1 | …s metal with fine gold plating, it delivers the shine and elegance of real gold jewellery. Features: Long-Lasting Shine: The sturdy brass base keeps t… | 92 |
| `red enamel finish` | material + plating | 1 | …apturing the romance of a single rose in miniature form. The rich red enamel finish on the petals contrasts strikingly against the polished gold detai… | 4 |
| `Red enamel rose` | material | 1 | …K gold-plated stainless steel, tarnish and water resistant Design: Red enamel rose pendant with gold stem and leaves Chain: Fine link chain, adjustabl… | 4 |
| `Red gemstone` | stone | 1 | Elegant Red gemstone statement ring Premium silver-finish with classic detailing Minimal yet bold design for effortless styling Lightweight & comforta… | 377 |
| `red glass` | material | 1 | Description: Make a bold statement with this radiant set of red glass bangles , beautifully adorned with shimmering golden bead accents. Crafted from … | 375 |
| `Red Ruby` | stone | 1 | Turn heads with our Red Ruby & Emerald Vine Anti-Tarnish Necklace — a bold gold-plated necklace featuring deep red ruby oval CZ stones nestled between… | 376 |
| `red ruby oval CZ` | stone | 1 | …Anti-Tarnish Necklace — a bold gold-plated necklace featuring deep red ruby oval CZ stones nestled between vibrant emerald green leaf accents in a gra… | 376 |
| `red ruby oval CZ stones` | stone | 1 | …-Tarnish Necklace — a bold gold-plated necklace featuring deep red ruby oval CZ stones nestled between vibrant emerald green leaf accents in a gracefu… | 376 |
| `red velvet` | material | 1 | His & Her Gold Initial Rings in red velvet box + Dairy Milk Silk + Ferrero Rocher x3 + Birthday bunting + fairy lights. Only ₹499. Choose your initial… | 105 |
| `rhodium plating` | material + plating | 1 | …yday outfits. Material: Durable alloy Plating: High-shine silver / rhodium plating Stone Type: Cubic zirconia crystals Design: Adjustable stack-style … | 426 |
| `rose enamel` | material | 1 | This elegant tulip bracelet features a soft rose enamel bud and detailed green leaves on a sleek lobster clasp chain. Crafted with a classic gold-plat… | 427 |
| `Rose gold` | material | 1 | Upgrade your jewelry collection with this gorgeous set of Rose gold rings! Featuring delicate designs with sparkling stones, these rings add a touch o… | 189 |
| `rose gold` | material | 1 | …n a delicate halo of pavé detailing. Suspended from a satellite-style rose gold chain with small beaded accents, this necklace has a soft, romantic fe… | 490 |
| `Rose Gold Gold-Tone Acrylic` | material + plating | 1 | …e Necklace Gold-Tone Twisted Hoop Earrings Satin Scrunchie – Rose Gold Gold-Tone Acrylic Bangle/Cuff Hershey's Kisses – Milk Chocolate Sunfeast Dark F… | 80 |
| `Rose gold plated` | material + plating | 1 | …n alone or stacked with other rings. Material: Alloy base Plating: Rose gold plated Stone Type: Cubic zirconia stones Design: V-shaped crystal band ri… | 382 |
| `Rose gold-plated stainless steel` | material + plating | 1 | …ely everyday piece or a heartfelt gift. Details: Material: Rose gold-plated stainless steel, tarnish and water resistant Stone: Clear cubic zirconia h… | 490 |
| `rose gold-plated stainless steel` | material + plating | 1 | …l that layers beautifully or shines on its own. Crafted in rose gold-plated stainless steel, it's tarnish and water resistant, so it stays beautiful w… | 490 |
| `rose-gold tone` | material + plating | 1 | Fashioned in a chic rose-gold tone, this V-shaped minimalist ring is accentuated with sparkling cubic zirconia stones along the band. The sleek curve … | 382 |
| `round cubic zirconia stones` | stone | 1 | …old plating for a rich finish 🔹 Stone Type: Princess-cut and round cubic zirconia stones 🔹 Design: Elegant dual design featuring floral and classic so… | 176 |
| `round CZ` | stone | 1 | …g silver-plated pink crystal drop earrings , designed with a sparkling round CZ top and a beautifully detailed teardrop frame. The lower section featu… | 425 |
| `Round Stone` | stone | 1 | Shine bright with our DC Jewelry Round Stone Adjustable Ring — a charming symbol of elegance and grace. Whether it's a special celebration or everyday… | 141 |
| `round white stones` | stone | 1 | …silver-toned nath, featuring a unique arrangement of baguette and round white stones. This high-fashion statement piece is perfect for celebrations. T… | 418 |
| `round-cut cubic zirconia` | stone | 1 | …g: Luxe gold plating that stays radiant 🔹 Stone Type: Dazzling round-cut cubic zirconia 🔹 Design: Sleek wavy band with full CZ embellishment 🔹 Size/Fi… | 488 |
| `round-cut cubic zirconia stones` | stone | 1 | …old plating for long-lasting shine 🔹 Stone Type: Brilliant round-cut cubic zirconia stones 🔹 Design: Modern crossover infinity band with pavé accents … | 278 |
| `ruby red` | stone | 1 | … Bracelet — a vibrant gold-plated bracelet featuring a stunning mix of ruby red, sky blue, emerald green, and lavender purple CZ stones set along a fl… | 332 |
| `ruby red kundan` | stone | 1 | … features soft pink meenakari square panels with pearl borders and ruby red kundan centres, flanking a heavily CZ stone-encrusted dial that dazzles fr… | 291 |
| `ruby stone` | stone | 1 | …lry collection. Features Premium antique gold finish Elegant Kundan & ruby stone detailing Intricate traditional floral craftsmanship Lightweight & co… | 451 |
| `ruby-colored` | stone | 1 | …afted with intricate floral motifs, sparkling white stones, and rich ruby-colored accents. Inspired by traditional Indian jewelry, this designer watch… | 451 |
| `ruby-colored stones` | stone | 1 | …raditional elegance with this gold-toned nath, featuring vibrant ruby-colored stones and a delicate pearl drop. This high-fashion piece is a stunning … | 259 |
| `ruby-colored synthetic zirconia` | stone | 1 | … this elegant red tulip pendant necklace. Featuring a deep ruby-colored synthetic zirconia bud and sparkling crystal leaves on a gold-finished chain, … | 378 |
| `ruby-red stones` | stone | 1 | …onal elegance with this gold-toned peacock nath, featuring vibrant ruby-red stones and a delicate pearl drop. This high-fashion statement piece is per… | 261 |
| `sapphire blue` | stone | 1 | …i-Tarnish Bracelet — a stunning gold-plated bracelet featuring deep sapphire blue oval stones nestled between delicate emerald green leaf motifs. Insp… | 86 |
| `sapphire blue oval stones` | stone | 1 | …ish Bracelet — a stunning gold-plated bracelet featuring deep sapphire blue oval stones nestled between delicate emerald green leaf motifs. Inspired b… | 86 |
| `shiny silver-tone finish` | material + plating | 1 | This stunning dual adjustable ring set is crafted with a shiny silver-tone finish and embellished with brilliant-cut cubic zirconia stones. Featuring … | 426 |
| `Silver Crystal` | material + stone | 1 | Shine with elegance in this Luxury Silver Crystal Bracelet Watch , crafted with a dazzling crystal-studded floral dial and a premium silver-tone finis… | 310 |
| `silver-plated blue` | material + plating | 1 | Add a touch of sophistication to your style with these stunning silver-plated blue and crystal floral stud earrings . Featuring a cluster of deep navy… | 419 |
| `silver-plated pink crystal` | material + plating + stone | 1 | Make a graceful statement with these stunning silver-plated pink crystal drop earrings , designed with a sparkling round CZ top and a beautifully deta… | 425 |
| `silver-tone` | material + plating | 1 | …tement accessory. The anti-tarnish finish helps maintain its elegant silver-tone appearance with proper care, while the rich blue dial adds a sophisti… | 481 |
| `Silver-tone finish` | material + plating | 1 | …r them together for a layered look or separately on each ankle. 🪙 Silver-tone finish — sleek and polished 🐍 Smooth snake chain body — flexible and com… | 413 |
| `silver-tone finish` | material + plating | 1 | … as accent pieces, giving it a clean yet detailed look. The sleek silver-tone finish makes it a timeless everyday payal that pairs with everything. Co… | 413 |
| `silver-toned finish` | material + plating | 1 | …shion piece shines brightest when kept away from water and perfumes. Store in a dry place after each wear to preserve its radiant silver-toned finish. | 410 |
| `solitaire crystal` | stone | 1 | …s stunning rose gold-toned tennis bracelet, featuring a brilliant solitaire crystal. Perfect for adding high-fashion glamour to any outfit. To preserv… | 187 |
| `solitaire cubic zirconia` | stone | 1 | …radiant gold plating, this exquisite ring features a sparkling solitaire cubic zirconia centerpiece with intricate twisted band accents beautifully se… | 27 |
| `Stainless Steel Gold Plated Stainless Steel` | material + plating | 1 | Stainless Steel Gold Plated Stainless Steel Anti Tarnish Nail Bracelet For Women balances design, versatility, and craftsmanship, making it an ideal a… | 236 |
| `Stones` | stone | 1 | …ghtweight gold-finish ring pairs beautifully with all outfits. ✨ Slim & Stylish Design ✨ Sparkling Stones ✨ Adjustable Fit ✨ Comfortable for Daily Use | 318 |
| `sturdy brass base` | material | 1 | …legance of real gold jewellery. Features: Long-Lasting Shine: The sturdy brass base keeps the ring looking bright and new for a long time with proper … | 92 |
| `synthetic stones` | stone | 1 | …aturing a delicate copper leaf design and shimmering multi-colored synthetic stones, this European fashion-inspired set adds a vibrant, sophisticated … | 104 |
| `Synthetic Synthetic Synthetic Zircon` | stone | 1 | A New Stylish And Luxurious Flower Bracelet Adorned with Synthetic Synthetic Synthetic Zircon , Perfect for Women'S Everyday Wear | 3 |
| `Synthetic Zirconia` | stone | 1 | …d Korean Cross-Border Women's Square Bracelet, Exquisite Colorful Stainless Steel Fashion Commuter Birthday Synthetic Zirconia Bracelet, Birthday Gift | 436 |
| `synthetic zirconia` | stone | 1 | …h this elegant yellow tulip pendant necklace. Featuring a vibrant synthetic zirconia bud and shimmering crystal leaves on a gold-finished copper chain… | 493 |
| `Tarnish-resistant finish` | plating | 1 | …parkling CZ stones Adjustable fit for comfortable all-day wear Tarnish-resistant finish for everyday styling A thoughtful gift under ₹200 for annivers… | 2 |
| `textured finish` | plating | 1 | …tard yellow color with gold bead embellishments Subtle shimmer and textured finish for a festive look Lightweight and comfortable for extended wear Pe… | 333 |
| `textured glass finish` | material + plating | 1 | …ring warmth, vibrance, and traditional charm to any outfit. The textured glass finish adds depth and sparkle, making this set perfect for festive and … | 333 |
| `textured gold-toned` | material + plating | 1 | … kada. The rich, marbled green enamel is beautifully paired with textured gold-toned vine work and dark floral accents. Designed with an anti-tarnish … | 194 |
| `tones` | plating | 1 | …is pastel green glass bangle set delicately embellished with sparkling stones. Designed for weddings, festive celebrations, and traditional occasions … | 339 |
| `velvet` | material | 1 | …y longer – no fading, no colour loss 12 pairs of earrings included in a velvet storage box – ready to mix & match Travel-friendly essentials like pape… | 308 |
| `white crystal stones` | stone | 1 | Elegant anti tarnish floral bracelet with sparkling white crystal stones and a lightweight gold finish. Perfect for daily wear, gifting, and special o… | 26 |
| `white CZ` | stone | 1 | Elevate your occasion look with this stunning mint green and white CZ choker necklace set. Featuring a beautifully hand-crafted design, the choker is … | 325 |
| `white tone` | plating | 1 | …uisite set of 12 ivory white glass bangles. Featuring a soft, classic white tone beautifully accented with delicate gold bead detailing, this bangle s… | 283 |
| `white zirconia` | stone | 1 | …h this silver-toned floral nath, intricately studded with sparkling white zirconia. This high-fashion accessory is perfect for adding a modern ethnic … | 423 |
| `yellow glass` | material | 1 | Brighten your jewelry collection with this elegant set of 12 mustard yellow glass bangles. Featuring a rich golden-yellow tone enhanced with delicate … | 333 |
| `zircon-studded` | stone | 1 | …ith its interlocked chain-style design. Alternating gold-plated and zircon-studded links create a dazzling effect, making this ring a chic and versati… | 45 |
| `zirconia` | stone | 1 | Elevate your accessory game with this high-end colorful zirconia necklace and earring set. Featuring a delicate copper leaf design and shimmering mult… | 104 |
| `zircons` | stone | 1 | …um Zircon Stones Design: Twin wave criss-cross band fully studded with zircons Colour: Gold Size Options: 6, 7, 8 Size 6 → Diameter: 1.6 cm Size 7 → D… | 68 |

