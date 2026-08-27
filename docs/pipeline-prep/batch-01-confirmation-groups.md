# Batch 01 confirmation groups

## Purpose

Every `attributes` candidate across the 423 Draft A objects extracted so far from `content-pipeline/incoming/2026-08-23-batch-01/` (94 from the prior extraction session plus 329 from the 2026-08-27 chunk 0-16 run — P297, P335, P336, P337 and P531 excluded, since those five are already priced-and-shot with owner-confirmed attributes and re-grouping them here would mix confirmed decisions back in with unconfirmed candidates), grouped by exact `(label, value)` string equality — no fuzzy matching, no normalisation, no correction of the source text, per this folder's [README](README.md) and skill rule 17 (`.claude/skills/draft-a-skills.md`).

**This is not a decision, a policy, or an input any code reads.** A pair appearing in the "grouped commons" section below is a candidate that happens to read identically across several products — it still needs the owner's confirmation, exactly like a singleton would. Grouping only means the owner can look at one row instead of forty and decide once.

## How to read this file

| Section | What's in it | Why it's separate |
| --- | --- | --- |
| [Grouped commons](#grouped-commons) | `(label, value)` pairs appearing identically in **3 or more** products | Safe to batch-confirm as a group once the owner agrees the value is correct |
| [Unverified-guess stone candidates](#unverified-guess-stone-candidates) | Every attribute with `stoneSource: "unverified-guess"`, regardless of how many products share the same guessed value | Excluded from grouped commons on purpose — a guess repeating across products is still a guess in each one, and batch-confirming it would launder an unverified claim through the appearance of consensus. Needs individual attention per skill rule 3 |
| [personalized: null cases](#personalized-null-cases) | Every product whose top-level `personalized` field is `null` | Ambiguous customization-adjacent language per skill rule 10 — each one needs the owner to read the source and decide, not a group decision |
| [Fully unique / ungroupable singles](#fully-unique--ungroupable-singles) | `(label, value)` pairs appearing in only 1 or 2 products (stone-guess attributes excluded, they're above) | Below the 3-product batch-confirm threshold — still real candidates, just not groupable |

## Grouped commons

107 distinct `(label, value)` pairs, covering 922 attribute candidates across 423 products. Sorted by product count, descending.

| Label | Value | Count | Product IDs |
| --- | --- | --- | --- |
| Stone | cubic zirconia | 65 | P105, P107, P111, P112, P113, P124, P125, P126, P127, P129, P130, P131, P132, P133, P134, P137, P139, P140, P143, P145, P147, P151, P152, P153, P156, P161, P162, P163, P164, P166, P172, P175, P176, P178, P180, P181, P182, P183, P184, P185, P186, P187, P188, P189, P190, P191, P192, P193, P194, P195, P196, P197, P198, P199, P200, P201, P202, P203, P206, P207, P208, P209, P315, P325, P326 |
| Material | glass | 37 | P214, P215, P216, P217, P218, P280, P281, P283, P284, P285, P286, P287, P288, P289, P290, P312, P313, P314, P339, P340, P341, P342, P343, P344, P345, P346, P347, P348, P349, P350, P351, P352, P417, P418, P419, P420, P421 |
| Weight | lightweight | 34 | P105, P111, P124, P125, P126, P127, P129, P130, P131, P132, P133, P134, P137, P139, P140, P143, P145, P147, P152, P271, P313, P314, P317, P324, P325, P327, P347, P349, P352, P355, P356, P358, P453, P455 |
| Material | alloy | 33 | P154, P155, P156, P158, P161, P163, P164, P165, P170, P173, P182, P183, P184, P185, P186, P187, P188, P189, P190, P191, P192, P193, P194, P195, P196, P197, P198, P199, P201, P205, P207, P209, P383 |
| Fit | adjustable | 24 | P182, P183, P184, P185, P186, P187, P188, P189, P190, P191, P192, P193, P194, P195, P196, P197, P198, P199, P200, P201, P239, P240, P357, P555 |
| Material | stainless steel | 23 | P220, P221, P222, P223, P224, P226, P227, P228, P230, P232, P233, P234, P235, P236, P238, P239, P394, P399, P494, P495, P496, P497, P498 |
| Plating | gold plating | 22 | P182, P183, P184, P185, P186, P187, P188, P189, P190, P191, P192, P193, P195, P196, P197, P199, P201, P229, P230, P235, P277, P278 |
| Material | rosegold-plated brass | 19 | P105, P111, P124, P125, P126, P127, P129, P130, P131, P132, P133, P134, P137, P139, P140, P143, P145, P147, P152 |
| Care Instructions | 💎 Clean gently with a microfiber or polishing cloth; 🚫 Avoid chemicals, water, and ultrasonic cleaners; 🛑 Remove while swimming, showering, or gardening; 🌡️ Store in a cool, dry place away from extreme temperatures | 18 | P182, P183, P184, P185, P186, P187, P188, P189, P190, P191, P192, P193, P195, P196, P197, P198, P199, P201 |
| Care | clean gently with microfiber or polishing cloth; avoid chemicals, water and ultrasonic cleaners; remove while swimming, showering or gardening; store in a cool, dry place | 17 | P124, P125, P126, P127, P129, P130, P131, P132, P133, P134, P137, P139, P140, P143, P145, P147, P152 |
| Design | star-shaped | 17 | P124, P125, P126, P127, P129, P130, P131, P132, P133, P134, P137, P139, P140, P143, P145, P147, P152 |
| Occasion | gifting (weddings, birthdays, Valentine's Day, festivals); teen girls and women; western and ethnic outfits | 17 | P124, P125, P126, P127, P129, P130, P131, P132, P133, P134, P137, P139, P140, P143, P145, P147, P152 |
| Plating | gold-plated | 16 | P154, P155, P158, P161, P164, P165, P172, P173, P203, P205, P207, P208, P369, P370, P384, P528 |
| Material | gold-toned metal, base metal unspecified | 15 | P451, P452, P459, P460, P461, P462, P463, P464, P465, P466, P467, P468, P469, P470, P471 |
| Finish/Plating | gold-plated | 14 | P564, P565, P566, P567, P568, P569, P570, P571, P572, P573, P574, P575, P576, P577 |
| Fit | adjustable, fits most finger sizes | 14 | P155, P158, P161, P172, P173, P175, P176, P180, P181, P202, P203, P206, P208, P229 |
| Base Material | stainless steel | 12 | P291, P293, P296, P302, P303, P304, P305, P306, P307, P308, P310, P311 |
| Finish | anti-tarnish finish | 12 | P240, P530, P539, P540, P541, P542, P543, P544, P549, P550, P552, P553 |
| Material | 18K gold-plated stainless steel | 12 | P630, P631, P632, P633, P635, P636, P637, P638, P639, P640, P641, P642 |
| Material | brass | 12 | P103, P153, P162, P166, P172, P200, P202, P203, P206, P210, P211, P408 |
| Size | one-size, adjustable | 12 | P296, P298, P299, P302, P303, P304, P305, P306, P307, P308, P310, P311 |
| Treatment | anti-tarnish | 12 | P291, P293, P296, P302, P303, P304, P305, P306, P307, P308, P310, P311 |
| Material/Finish | gold-toned | 11 | P422, P423, P424, P425, P426, P427, P433, P434, P435, P436, P437 |
| Plating | 18K gold-plated | 11 | P293, P296, P302, P303, P304, P305, P306, P307, P308, P310, P311 |
| Plating/Finish | gold-toned | 11 | P472, P473, P476, P477, P480, P482, P483, P484, P485, P486, P487 |
| Set Quantity | 12 glass bangles | 11 | P341, P342, P343, P344, P345, P346, P347, P348, P349, P350, P351 |
| Care Instructions | Wipe with a soft cloth after every use; avoid contact with harsh chemicals, sprays, and perfumes; store in a flat box to prevent scratches; do not soak in water. | 10 | P296, P302, P303, P304, P305, P306, P307, P308, P310, P311 |
| Care instructions | Clean gently with a microfiber or polishing cloth; avoid chemicals, water, and ultrasonic cleaners; remove while swimming, showering, or gardening; store in a cool, dry place away from extreme temperatures | 10 | P153, P154, P155, P158, P161, P164, P165, P166, P170, P173 |
| Finish | gold-plated, anti-tarnish, water-resistant | 10 | P247, P248, P249, P250, P252, P254, P255, P256, P261, P262 |
| Movement | Quartz | 10 | P612, P613, P614, P615, P616, P617, P619, P621, P622, P623 |
| Net Quantity | 1 | 10 | P296, P302, P303, P304, P305, P306, P307, P308, P310, P311 |
| Care Instructions | Keep dry; store safely in a dry place after every wear | 9 | P446, P466, P467, P468, P469, P470, P471, P472, P473 |
| Finish | anti-tarnish gold-tone | 9 | P612, P613, P614, P615, P617, P619, P620, P622, P623 |
| Care instructions | Keep away from perfumes, water, excessive sweat and harsh chemicals. Store in a dry place when not in use to help maintain the finish. | 8 | P612, P613, P614, P615, P616, P617, P619, P621 |
| Chain | Fine link chain, adjustable length | 8 | P631, P632, P635, P636, P637, P640, P641, P642 |
| Finish | gold finish, anti-tarnish, water-resistant | 8 | P251, P253, P258, P259, P260, P263, P264, P265 |
| Finish | smooth, glossy finish | 8 | P339, P340, P341, P342, P343, P344, P345, P346 |
| Finish/Coating | anti-tarnish coating | 8 | P554, P555, P564, P565, P566, P567, P568, P569 |
| Height | 1.8 cm | 8 | P221, P222, P223, P232, P234, P236, P238, P239 |
| Material | 316L stainless steel | 8 | P570, P571, P572, P573, P574, P575, P576, P577 |
| Water Resistance | waterproof & sweat-resistant | 8 | P570, P571, P572, P573, P574, P575, P576, P577 |
| Weight | lightweight and comfortable | 8 | P319, P320, P323, P329, P330, P331, P332, P333 |
| Care Instructions | Avoid prolonged exposure to harsh chemicals and perfumes | 7 | P570, P572, P573, P574, P575, P576, P577 |
| Finish | anti-tarnish | 7 | P220, P224, P226, P353, P369, P370, P510 |
| Movement | quartz | 7 | P386, P387, P388, P389, P390, P392, P620 |
| Plating | rose gold-plated | 7 | P175, P176, P178, P180, P181, P202, P206 |
| Care Instructions | Keep away from moisture and perfumes; store safely in a dry place after use | 6 | P452, P459, P461, P487, P496, P497 |
| Embellishment | golden bead accents | 6 | P214, P216, P217, P312, P313, P314 |
| Material/Finish | silver-toned | 6 | P438, P439, P440, P441, P442, P443 |
| Packaging | comes without box | 6 | P539, P540, P541, P542, P543, P544 |
| Plating | 18K gold plating | 6 | P227, P228, P233, P236, P238, P239 |
| Size to Diameter Mapping | Size 6 = 1.6cm diameter; Size 7 = 1.7cm diameter; Size 8 = 1.8cm diameter | 6 | P230, P232, P234, P235, P238, P239 |
| Care | wipe with a soft cloth after use; store in a dry place | 5 | P242, P243, P244, P245, P246 |
| Care instructions | Keep away from water and perfumes for long-lasting shine. Store in a dry place when not in use | 5 | P175, P176, P178, P180, P181 |
| Chain & Clasp | delicate gold chain with secure clasp | 5 | P564, P565, P566, P567, P568 |
| Clasp | openable clasp | 5 | P242, P243, P244, P245, P246 |
| Colour | gold | 5 | P221, P222, P223, P236, P353 |
| Design | golden dotted detailing | 5 | P339, P340, P341, P343, P344 |
| Design | minimal yet bold statement design | 5 | P329, P330, P331, P332, P333 |
| Embellishment | ghungroo bells | 5 | P386, P389, P557, P558, P559 |
| Finish | anti-tarnish, water-resistant | 5 | P274, P275, P276, P277, P278 |
| Finish | long-lasting shine, rust-resistant | 5 | P242, P243, P244, P245, P246 |
| Finish | silver-finish | 5 | P329, P330, P331, P332, P333 |
| Material | Satin | 5 | P585, P587, P588, P589, P590 |
| Material | anti-tarnish metal | 5 | P242, P243, P244, P245, P246 |
| Material | gold-plated | 5 | P318, P320, P323, P324, P327 |
| Material | silver-toned metal, base metal unspecified | 5 | P444, P445, P446, P448, P450 |
| Occasion | casual, festive, party wear | 5 | P242, P243, P244, P245, P246 |
| Plating | gold finish | 5 | P194, P529, P540, P541, P542 |
| Production Note | handmade — piece-to-piece variation is normal | 5 | P232, P234, P236, P238, P239 |
| Size | adjustable, fits most finger sizes | 5 | P112, P113, P151, P328, P334 |
| Care Instructions | Keep away from moisture and perfumes; store safely after use | 4 | P460, P482, P485, P486 |
| Care instructions | Keep away from moisture and store safely after use to preserve golden luster of charms | 4 | P499, P500, P501, P502 |
| Closure | Adjustable chain closure | 4 | P601, P602, P603, P604 |
| Design Accent | emerald-green leaf-shaped accents | 4 | P564, P565, P567, P568 |
| Dial colour | Green | 4 | P612, P613, P614, P621 |
| Finish | anti-tarnish coating | 4 | P227, P228, P233, P509 |
| Finish | gold finish, anti-tarnish and water-resistant | 4 | P266, P269, P270, P273 |
| Material | silver-plated | 4 | P315, P319, P325, P326 |
| Material/finish - chain | gold-toned metal chain, anti-tarnish finish | 4 | P517, P518, P519, P520 |
| Packaging | premium box | 4 | P232, P234, P238, P239 |
| Plating/Finish | silver-toned | 4 | P474, P479, P481, P488 |
| Size | adjustable | 4 | P105, P111, P355, P356 |
| Weight | 1.4 gm | 4 | P232, P234, P238, P239 |
| Weight | 1.4gm | 4 | P221, P222, P223, P236 |
| Care Instructions | Handle gently and store in a soft pouch to avoid breakage | 3 | P344, P345, P346 |
| Care Instructions | Keep away from moisture and perfumes; store safely in a dry place after every wear | 3 | P443, P462, P477 |
| Care Instructions | Keep dry; store safely after every wear | 3 | P445, P464, P465 |
| Care instructions | Clean gently with a microfiber or polishing cloth; avoid chemicals, water, and ultrasonic cleaners; remove while swimming, showering, or gardening; store in a cool, dry place away from extreme temperatures. | 3 | P207, P208, P209 |
| Care instructions | Keep away from perfumes, water, excessive sweat and harsh chemicals; store in a dry place when not in use to help maintain the finish | 3 | P609, P610, P611 |
| Chain | triple gold chains | 3 | P387, P388, P392 |
| Chain material | gold-toned chain | 3 | P527, P530, P550 |
| Clip type | Alligator clip | 3 | P587, P590, P591 |
| Colour | gold-toned | 3 | P428, P430, P454 |
| Design | gold bead detailing | 3 | P347, P350, P351 |
| Dial colour | Emerald green | 3 | P619, P622, P623 |
| Dial markers | Roman numeral | 3 | P613, P614, P615 |
| Finish | Antique gold-tone finish | 3 | P602, P603, P604 |
| Finish | glossy finish | 3 | P280, P286, P288 |
| Fit | adjustable, fits most finger sizes comfortably | 3 | P154, P165, P207 |
| Movement type | Quartz | 3 | P609, P610, P611 |
| Net quantity | 1 bracelet | 3 | P103, P210, P211 |
| Packaging | delivered in a box | 3 | P221, P222, P223 |
| Plating | 18k gold tone plated | 3 | P221, P222, P223 |
| Plating | gold finish/plating | 3 | P274, P275, P276 |
| Plating | silver-plated | 3 | P162, P170, P209 |
| Weight | lightweight, smooth, and comfortable | 3 | P348, P350, P351 |

## Unverified-guess stone candidates

160 candidates across 423 products, none backed by `data/stone-terms.json` (`stoneSource: "unverified-guess"`). Sorted by proposed value, then product id, so identically-worded guesses still sit together for scanning — but each row is its own confirmation decision, not a batch.

| Product ID | Label | Source term (displayTerm) | Proposed value | Quoted source phrase |
| --- | --- | --- | --- | --- |
| P599 | Stone | Multicolor Gemstone | Assorted coloured glass or synthetic gemstones, exact material unclear from text | Multicolor Gemstone tulip Bracelet |
| P607 | Stone | baguette-cut crystal | Baguette-cut glass or cubic zirconia, exact material unclear from text | Baguette-cut crystal bracelet |
| P598 | Stone | Ruby & Emerald | Coloured glass or synthetic stone, exact material unclear from text | Ruby & Emerald Stone Necklace |
| P599 | Stone | Ruby & Crystal | Coloured glass or synthetic stone, exact material unclear from text | Ruby & Crystal Pendant Necklace (Gold Tone) |
| P605 | Stone | Kundan & Crystal Stones | Glass or crystal stones in Kundan-style setting, exact material unclear from text | Stone Type: Kundan & Crystal Stones |
| P607 | Stone | crystal | Glass or cubic zirconia, exact material unclear from text | dazzling crystal-studded floral dial |
| P602 | Stone | Kundan | Glass or synthetic stone set in traditional Kundan style, exact material unclear from text | Elegant Kundan & ruby stone detailing |
| P603 | Stone | Kundan | Glass or synthetic stone set in traditional Kundan style, exact material unclear from text | sparkling Kundan stones, vibrant red & green accents |
| P604 | Stone | Kundan | Glass or synthetic stone set in traditional Kundan style, exact material unclear from text | sparkling Kundan stones, decorative ghungroo charms, and graceful chain tassels |
| P316 | Stone | Kundan | Kundan-style stone setting, exact material unclear from text | premium Kundan stones |
| P611 | Material | pearl | Pearl accents (natural or imitation unclear from text) | a unique pearl-detail chain bracelet |
| P601 | Material | pearl beads | Pearl beads (natural or imitation unclear from text) | Designed with premium white pearl beads, vibrant pink & green accents, and intricate meenakari-inspired charms |
| P602 | Stone | ruby-colored accents | Ruby-coloured stone or glass, exact material unclear from text | rich ruby-colored accents |
| P552 | Stone | crystals | baguette-cut crystals (glass or cubic zirconia, unclear from text) | full row of sparkling baguette-cut crystals |
| P329 | Stone | _(none)_ | black gemstone, exact type unclear from text | Elegant black gemstone statement ring |
| P332 | Stone | _(none)_ | black gemstone, exact type unclear from text | Elegant Black gemstone statement ring |
| P387 | Stone | CZ | cubic zirconia | sparkling CZ stones |
| P391 | Stone | CZ | cubic zirconia | flanking a heavily CZ stone-encrusted watch dial |
| P392 | Stone | CZ | cubic zirconia | with sparkling CZ stone centres |
| P393 | Stone | CZ | cubic zirconia | flanking a heavily CZ stone-encrusted dial |
| P552 | Stone | CZ | cubic zirconia | this stunning CZ tennis bracelet |
| P553 | Stone | CZ | cubic zirconia | dainty square CZ stone charm |
| P555 | Stone | CZ | cubic zirconia | sparkling green CZ leaves |
| P564 | Stone | CZ | cubic zirconia | ❤️ Deep red ruby oval CZ + emerald green leaf stones |
| P565 | Stone | CZ | cubic zirconia | 💜 Soft lavender purple oval CZ + emerald green leaf stones |
| P566 | Stone | CZ | cubic zirconia | 💎 Sparkling clear white marquise CZ stones |
| P567 | Stone | CZ | cubic zirconia | 🌸 Blush pink oval CZ + emerald green leaf stones |
| P568 | Stone | CZ | cubic zirconia | 💜 Deep amethyst purple oval CZ + emerald green leaf stones |
| P569 | Stone | CZ | cubic zirconia | 🌸 Blush pink + deep purple marquise CZ stones |
| P522 | Stone | zirconia | cubic zirconia (multi-colored, synthetic) | this high-end colorful zirconia necklace and earring set. Featuring a delicate copper leaf design and shimmering multi-colored synthetic stones |
| P394 | Stone | Synthetic Zirconia | cubic zirconia (synthetic) | Exquisite Colorful Stainless Steel Fashion Commuter Birthday Synthetic Zirconia Bracelet |
| P525 | Stone - bud | zirconia | cubic zirconia (synthetic, ruby-colored) | a deep ruby-colored synthetic zirconia bud |
| P524 | Stone - bud | zirconia | cubic zirconia (synthetic, yellow) | a vibrant synthetic zirconia bud |
| P232 | Stone | zircon | cubic zirconia or glass, unclear from text | Premium Zircon Stones |
| P234 | Stone | zircon | cubic zirconia or glass, unclear from text | Premium Zircon Stones |
| P235 | Stone | zircon | cubic zirconia or glass, unclear from text | smaller zircon stones |
| P238 | Stone | zircon | cubic zirconia or glass, unclear from text | Premium Zircon Stones |
| P239 | Stone | zircon | cubic zirconia or glass, unclear from text | Premium Zircon Stones |
| P325 | Stone | _(none)_ | deep navy blue stone, exact type unclear from text | Featuring a cluster of deep navy blue stones |
| P356 | Stone | crystal | glass crystal or cubic zirconia, unclear from text | featuring tiny crystal stones |
| P453 | Stone | crystal | glass crystal or cubic zirconia, unclear from text | delicate crystal accents |
| P454 | Stone | crystal | glass crystal or cubic zirconia, unclear from text | a shimmering crystal-studded heart |
| P455 | Stone | crystal | glass crystal or cubic zirconia, unclear from text | fine crystal accents |
| P456 | Stone | crystal | glass crystal or cubic zirconia, unclear from text | a brilliant solitaire crystal |
| P458 | Stone | crystal | glass crystal or cubic zirconia, unclear from text | Adorned with shimmering crystals |
| P520 | Stone | emerald crystal | glass or cubic zirconia (emerald-green colored), unclear from text | this emerald crystal vine necklace. Featuring a vibrant green oval centerpiece flanked by shimmering crystal-encrusted leaves |
| P628 | Stone | _(none)_ | glass or cubic zirconia crystals, unclear from text | sparkling crystal-encrusted letter "A" pendant |
| P218 | Stone | crystal | glass or cubic zirconia, unclear from text | eye-catching crystal embellishments |
| P220 | Stone | _(none)_ | glass or cubic zirconia, unclear from text | diamond-cut pattern studded with brilliant stones |
| P224 | Stone | _(none)_ | glass or cubic zirconia, unclear from text | one side of the band shines with delicate stone studs |
| P226 | Stone | crystals | glass or cubic zirconia, unclear from text | one embellished with sparkling crystals |
| P227 | Stone | crystal | glass or cubic zirconia, unclear from text | sparkling crystals |
| P240 | Stone | crystal | glass or cubic zirconia, unclear from text | sparkling crystals |
| P285 | Stone | stone | glass or cubic zirconia, unclear from text | Work: Golden floral stone-studded design |
| P286 | Stone | stone | glass or cubic zirconia, unclear from text | Work: Golden stone-studded floral design |
| P287 | Stone | stone | glass or cubic zirconia, unclear from text | Work: Stone-studded floral design |
| P288 | Stone | stone | glass or cubic zirconia, unclear from text | Work: Stone-studded design |
| P289 | Stone | stone | glass or cubic zirconia, unclear from text | Pastel green color with hand-embellished stone detailing |
| P290 | Stone | stone | glass or cubic zirconia, unclear from text | Handcrafted with premium-quality glass and embellished with fine stone detailing |
| P293 | Stone | Artificial Stones | glass or cubic zirconia, unclear from text | Stone Type: Artificial Stones |
| P296 | Stone | crystal | glass or cubic zirconia, unclear from text | framed by a delicate halo of sparkling crystals |
| P303 | Stone | diamond-like stone | glass or cubic zirconia, unclear from text | a sparkling diamond-like stone at its center |
| P304 | Stone | crystal | glass or cubic zirconia, unclear from text | featuring intricate details and a small dangling crystal |
| P338 | Stone | _(none)_ | glass or cubic zirconia, unclear from text | delicate designs with sparkling stones |
| P342 | Stone | crystal | glass or cubic zirconia, unclear from text | delicate crystal-style dotted embellishments |
| P346 | Stone | crystal | glass or cubic zirconia, unclear from text | delicate crystal-style dotted embellishments |
| P357 | Stone | crystal | glass or cubic zirconia, unclear from text | featuring tiny crystal stones |
| P358 | Stone | _(none)_ | glass or cubic zirconia, unclear from text | delicate gold chain and sparkling stone |
| P437 | Stone | crystals | glass or cubic zirconia, unclear from text | delicate crystals |
| P441 | Stone | crystal | glass or cubic zirconia, unclear from text | sparkling crystal-studded design |
| P442 | Stone | crystal | glass or cubic zirconia, unclear from text | sparkling crystal accents |
| P443 | Stone | crystals | glass or cubic zirconia, unclear from text | shimmering crystals |
| P445 | Stone | crystal | glass or cubic zirconia, unclear from text | a vibrant blue center surrounded by a shimmering crystal halo |
| P446 | Stone | crystal | glass or cubic zirconia, unclear from text | a brilliant blue charm surrounded by a sparkling crystal halo |
| P448 | Stone | crystal | glass or cubic zirconia, unclear from text | a seamless line of brilliant shimmering crystals |
| P450 | Stone | crystal | glass or cubic zirconia, unclear from text | subtle crystal detailing |
| P451 | Stone | crystal | glass or cubic zirconia, unclear from text | a crystal-studded heart |
| P452 | Stone | crystal | glass or cubic zirconia, unclear from text | features a crystal-studded heart lock with delicate wings |
| P459 | Stone | crystal | glass or cubic zirconia, unclear from text | an interlocking crystal heart and infinity symbol |
| P460 | Stone | crystal | glass or cubic zirconia, unclear from text | Featuring shimmering crystal accents |
| P461 | Stone | crystal | glass or cubic zirconia, unclear from text | Adorned with shimmering crystals |
| P462 | Stone | crystal | glass or cubic zirconia, unclear from text | Featuring a crystal-studded lifeline motif |
| P472 | Stone | crystal | glass or cubic zirconia, unclear from text | a brilliant crystal-studded tennis strand |
| P477 | Stone | white stone | glass or cubic zirconia, unclear from text | this exquisite gold-toned white stone nath |
| P479 | Stone | white stones | glass or cubic zirconia, unclear from text | featuring a brilliant cluster of white stones and a delicate teardrop charm |
| P480 | Stone | white stones | glass or cubic zirconia, unclear from text | featuring a delicate circle of shimmering white stones and a dainty teardrop charm |
| P481 | Stone | white stones (baguette and round cut) | glass or cubic zirconia, unclear from text | featuring a unique arrangement of baguette and round white stones |
| P482 | Stone | white stones | glass or cubic zirconia, unclear from text | Featuring shimmering white stones and a delicate drop charm |
| P484 | Stone | white stones | glass or cubic zirconia, unclear from text | beautifully accented with shimmering white stones and a delicate pearl drop |
| P485 | Stone | white stones | glass or cubic zirconia, unclear from text | Featuring a cluster of shimmering white stones and a graceful teardrop drop |
| P486 | Stone | white stones | glass or cubic zirconia, unclear from text | featuring a vibrant mix of ruby, emerald, and white stones |
| P488 | Stone | white stones | glass or cubic zirconia, unclear from text | featuring a delicate circle of shimmering white stones and a dainty teardrop charm |
| P512 | Stone | crystal | glass or cubic zirconia, unclear from text | a sparkling pink crystal bud |
| P519 | Stone | crystal | glass or cubic zirconia, unclear from text | a brilliant vine of shimmering marquise-cut crystals |
| P524 | Stone - leaves | crystal | glass or cubic zirconia, unclear from text | shimmering crystal leaves |
| P525 | Stone - leaves | crystal | glass or cubic zirconia, unclear from text | sparkling crystal leaves |
| P526 | Stone - leaves | crystal | glass or cubic zirconia, unclear from text | crystal-accented leaves |
| P542 | Stone | crystal | glass or cubic zirconia, unclear from text | sparkling white crystal stones |
| P544 | Stone | crystal | glass or cubic zirconia, unclear from text | blush pink crystal stones |
| P547 | Stone | crystal | glass or cubic zirconia, unclear from text | crystal leaf accents |
| P548 | Stone | crystal | glass or cubic zirconia, unclear from text | crystal leaf accents |
| P612 | Stone | _(none)_ | glass or cubic zirconia, unclear from text | Sparkling stone detailing on the bracelet |
| P615 | Stone | _(none)_ | glass or cubic zirconia, unclear from text | Translucent crystal-style bracelet detailing |
| P642 | Stone (border accents) | _(none)_ | glass or cubic zirconia, unclear from text (clear crystal border accents) | Stone: Mother-of-pearl center, clear crystal border accents |
| P639 | Stone (chain spacers) | _(none)_ | glass or cubic zirconia, unclear from text (clear crystal spacers) | Stone: Pink and green cubic zirconia tulip charms, clear crystal spacers |
| P638 | Stone | _(none)_ | glass or cubic zirconia, unclear from text (purple emerald-cut center stone with clear crystal leaf accents) | Stone: Emerald-cut amethyst-purple center stone, clear crystal leaf accents |
| P476 | Stone | emerald-colored stones | glass or synthetic emerald-colored stone, unclear from text | intricately studded with ruby and emerald-colored stones |
| P486 | Stone | emerald | glass or synthetic emerald-colored stone, unclear from text | featuring a vibrant mix of ruby, emerald, and white stones |
| P487 | Stone | multi-colored stones | glass or synthetic multi-colored stones, unclear from text | Featuring a radiant mix of multi-colored stones |
| P476 | Stone | ruby-colored stones | glass or synthetic ruby-colored stone, unclear from text | intricately studded with ruby and emerald-colored stones |
| P483 | Stone | ruby-colored stones | glass or synthetic ruby-colored stone, unclear from text | featuring vibrant ruby-colored stones and a delicate pearl drop |
| P486 | Stone | ruby | glass or synthetic ruby-colored stone, unclear from text | featuring a vibrant mix of ruby, emerald, and white stones |
| P526 | Stone - bud | cat's eye | glass/cat's-eye-effect fiber-optic glass bead, unclear from text — likely synthetic 'cat's eye' glass rather than genuine chrysoberyl cat's eye | a shimmering cat's eye stone bud |
| P333 | Stone | _(none)_ | green gemstone, exact type unclear from text | Elegant Green gemstone statement ring |
| P623 | Stone | _(none)_ | green glass or cubic zirconia stones, unclear from text | Oval link chain embedded with green stone accents |
| P543 | Stone | _(none)_ | green stones (material unspecified) | sparkling green stones |
| P389 | Pendant | Kundan | grey floral kundan pendant | a beautiful grey floral kundan pendant |
| P523 | Material - beads | pearl | imitation (faux) pearl, baroque-shaped | this baroque imitation pearl bracelet |
| P430 | Stone | faux pearls | imitation pearl | lustrous faux pearls |
| P617 | Stone | _(none)_ | imitation pearl or glass beads, unclear from text | Pearl-style detailing on the bracelet |
| P386 | Stonework | Kundan | kundan | sparkling kundan accents |
| P387 | Stonework | Kundan | kundan | elaborate square kundan frames |
| P388 | Stonework | Kundan | kundan | teardrop kundan centres |
| P393 | Stonework | Kundan | kundan (ruby red) | ruby red kundan centres |
| P391 | Embellishment | Kundan | kundan medallion beads | Intricate kundan medallion beads |
| P557 | Stone/Setting | Kundan | kundan work (glass or stone set in gold foil, exact material unclear from text) | delicate red & green lotus kundan charms |
| P559 | Stone/Setting | Kundan | kundan work (glass or stone set in gold foil, exact material unclear from text) | intricate kundan mandala medallions |
| P353 | Stone | zircon | likely cubic zirconia, unclear from text | One side sparkles with premium zircon stones |
| P330 | Stone | _(none)_ | maroon gemstone, exact type unclear from text | Elegant Maroon gemstone statement ring |
| P457 | Stone | marquise solitaire | marquise-cut solitaire stone, material unclear from text | a brilliant marquise solitaire |
| P315 | Stone | _(none)_ | mint-colored stone, exact type unspecified in text | the choker is adorned with alternating mint stones |
| P327 | Stone | _(none)_ | multicolor marquise and princess-cut crystal cluster (pink, mint green, amber, lavender) with clear cubic zirconia, exact stone types unclear from text | Featuring a vibrant mix of marquise and princess-cut stones in pink, mint green, amber, lavender, and clear CZ |
| P393 | Pendant | Kundan | multicolour kundan chand (moon-shaped) pendant | Below flows a multicolour kundan chand pendant |
| P323 | Stone | _(none)_ | pastel pink crystal petals, exact type unclear from text | Featuring six faceted petal stones in a soft pastel pink shade and a brilliant crystal center |
| P326 | Stone | _(none)_ | pastel pink marquise-cut stone, exact type unclear from text | The lower section features multiple pastel pink marquise-cut stones arranged in an elegant, airy pattern |
| P463 | Stone | pearl | pearl (glass/faux or genuine, unclear from text) | a delicate pearl strand |
| P465 | Stone | pearl | pearl (glass/faux or genuine, unclear from text) | a classic pearl strand |
| P383 | Stone | Pearls | pearl (natural or imitation, unclear from text) | Stone type:Pearls |
| P532 | Stone (hamper bracelet component) | Pearl | pearl (real or faux, unclear from text) | Anti-Tarnish Pearl Bracelet |
| P259 | Stone | pearl | pearl (real or imitation unclear from text) | featuring a bold central pearl |
| P260 | Stone | pearl | pearl (real or imitation unclear from text) | featuring a central pearl accent |
| P299 | Stone | pearl | pearl (real or imitation unclear from text) | features a lustrous pearl at its center, surrounded by beautifully detailed petals |
| P558 | Stone/Material | _(none)_ | pearl (real or imitation unclear from text) | pearl accents |
| P483 | Material | pearl | pearl, type unspecified from text | a delicate pearl drop |
| P484 | Material | pearl | pearl, type unspecified from text | a delicate pearl drop |
| P319 | Stone | _(none)_ | pink zircon-type stone, exact composition unclear from text | crafted with sparkling pink zircon stones |
| P391 | Stonework | Polki Kundan | polki kundan | with polki kundan centres |
| P334 | Stone | green crystal zircon | rectangular green crystal, exact type unclear from text | Stone Type: Rectangular green crystal zircon |
| P331 | Stone | _(none)_ | red gemstone, exact type unclear from text | Elegant Red gemstone statement ring |
| P389 | Charm/motif | Kundan | red tulip kundan charms | delicate red tulip kundan charms |
| P434 | Stone/Centerpiece | pearl-like | resin or glass imitation pearl, unclear from text | shimmering, pearl-like heart centerpiece |
| P559 | Stone/Material | _(none)_ | seed pearls (real or imitation unclear from text) | bordered with delicate seed pearls |
| P324 | Stone | _(none)_ | soft mint stones with a crystal center, exact type unclear from text | Designed with soft mint stones arranged around a sparkling crystal center |
| P328 | Stone | _(none)_ | square-cut pink crystal, exact type unclear from text | Featuring a radiant square-cut pink crystal set on a sleek gold-plated band |
| P398 | Stone | Synthetic Zircon | synthetic zirconia (cubic zirconia), based on 'Synthetic Zircon' wording | Adorned with Synthetic Synthetic Synthetic Zircon |
| P355 | Stone | double-rectangle stone | two rectangular stones, type unclear from text | this modern double-rectangle stone ring |
| P228 | Stone | stones | unspecified stones - material unclear from text | shimmering stones |
| P233 | Stone | stones | unspecified stones - material unclear from text | finely set stones |
| P281 | Stone | stones | unspecified stones - material unclear from text | traditional design with embedded stones |
| P432 | Stone | stone-studded | unspecified stones — likely glass crystal or cubic zirconia, unclear from text | stone-studded tennis bracelet |

## personalized: null cases

7 products where extraction could not resolve `personalized` to `true` or `false` — ambiguous customization-adjacent language per skill rule 10. Each needs the owner to read the source and decide the actual mechanism (or lack of one).

| Product ID | Reference title | Notes recorded at extraction |
| --- | --- | --- |
| P308 | Designer-Inspired Coin and Initial Necklace - Anti-Tarnish Gold Jewelry | text describes a fixed 'coin and initial charm' design and tags it 'personalized elements' / 'personalized necklace' in marketing copy, but no naming/engraving mechanism is described (the initial charm is not shown as customer-chosen) — treated as ambiguous, personalized left null. |
| P510 | Blush Pink Floral Anti-Tarnish Kada | personalized is left null deliberately: the copy sells "gold-leaf engravings", and engraving is explicit personalisation language under skill rule 10 — but here it reads as a decorative pattern on the kada itself, and the export carries no engraving option, text field or any mechanism for a shopper to choose engraved content. Owner must resolve at review: if the engraving is purely decorative (most likely), set personalized: false; if buyers can request engraved content, an option design is needed before publish (personalized: true). |
| P513 | Gold Heart Locket Adjustable Open Ring | personalized: null — rawContent mentions customizing 'your style with replaceable accessories' (swappable openable-locket inserts), which is customization-adjacent but names no naming/engraving mechanism; originalCategories also tags this 'Personalised Item', reinforcing the ambiguity rather than resolving it. |
| P535 | Couple Birthday Hamper - Silver Edition | personalized is left null deliberately: the copy says "Choose your initials at checkout!" for the His & Her initial rings, which is explicit personalisation language — but the export carries NO letter-selection option or variant, and the old site's at-checkout mechanism does not exist in this store. Owner must resolve at review: if buyers pick initials, this needs an option/variant design before publish (personalized: true); if the rings ship with fixed letters, personalized: false and the copy overpromises. / Contents name third-party FMCG brands (Dairy Milk Silk, Ferrero Rocher) — real contents facts, kept as candidates; stock/substitution wording is an owner call for Phase 2. |
| P536 | Couple Birthday Hamper - Gold Edition | personalized is left null deliberately: the copy says "Choose your initials!" for the His & Her initial rings, which is explicit personalisation language — but the export carries NO letter-selection option or variant. Owner must resolve at review: if buyers pick initials, this needs an option/variant design before publish (personalized: true); if the rings ship with fixed letters, personalized: false and the copy overpromises. / Price discrepancy: the export's reference price is ₹480 but the source copy says "Only ₹499" — both are reference only; the real price is a separate owner decision at review. / Contents name third-party FMCG brands (Dairy Milk Silk, Ferrero Rocher) — real contents facts, kept as candidates; stock/substitution wording is an owner call for Phase 2. |
| P545 | Birthday Hamper for Her | personalized set to null — 'Initial Ring' component name suggests possible customization but the source text states no explicit choose-your-initial mechanism; ambiguous. |
| P628 | A Letter Necklace | personalized set to null: raw content markets 'a personal touch' and 'celebrating your name, initials' but the raw block defines a single fixed 'A' pendant with no variants for a customer-chosen letter — no actual naming/engraving mechanism found in source, ambiguous whether this is genuinely personalizable. |

## Fully unique / ungroupable singles

662 distinct `(label, value)` pairs appearing in only 1 or 2 products (stone-guess attributes excluded — see above), covering 731 attribute candidates. Grouped by label for readability; each pair still needs its own confirmation.

| Label | Value | Count | Product IDs |
| --- | --- | --- | --- |
| Additional Use | doubles as a bracelet/wrist accessory | 1 | P584 |
| Band Type | soft stretchable elastic band | 1 | P584 |
| Band type | Soft stretchable elastic band | 1 | P585 |
| Base Colour | gold | 1 | P291 |
| Base material | stainless steel | 2 | P370, P382 |
| Beadwork | vibrant coloured beads | 1 | P558 |
| Bezel design | Cross-bezel design | 1 | P622 |
| Border/trim | pearl borders | 1 | P393 |
| Bracelet material | mesh (base material not specified) | 1 | P621 |
| Bracelet material | stainless-steel-style mesh (material not confirmed) | 1 | P616 |
| Bracelet style | Decorative link bracelet | 1 | P615 |
| Bracelet style | Flexible mesh bracelet strap | 1 | P622 |
| Bracelet style | Interlocking chain-link design | 1 | P612 |
| Bracelet style | Multi-link bracelet | 1 | P614 |
| Bracelet style | Open-oval link chain strap | 1 | P623 |
| Bracelet style | Polished bead bracelet | 1 | P619 |
| Bracelet style | Rectangular-link bracelet | 1 | P613 |
| Bracelet style | Statement chain bracelet | 1 | P617 |
| Care | avoid contact with water and perfume | 1 | P103 |
| Care | avoid contact with water or perfumes; clean with a soft cloth | 1 | P111 |
| Care | avoid moisture and chemicals; clean with a soft cloth after use | 1 | P107 |
| Care | avoid moisture; store in a dry, safe place after wear | 1 | P429 |
| Care | avoid perfumes and moisture; store in a dry place after use | 1 | P428 |
| Care | avoid water and perfumes; store in a dry, soft pouch | 1 | P431 |
| Care | avoid water, perfumes and lotions; store in a dry place after use | 1 | P430 |
| Care | keep away from moisture and perfumes; store in a dry place after every wear | 2 | P456, P458 |
| Care | keep away from moisture and perfumes; store in a dry place after use | 1 | P453 |
| Care | keep away from moisture and perfumes; store safely in a dry place | 1 | P457 |
| Care | keep away from perfumes, water, excessive sweat and harsh chemicals; store in a dry place when not in use | 1 | P620 |
| Care | keep away from water and perfumes; store in a dry place when not in use | 2 | P112, P113 |
| Care | keep away from water and perfumes; wipe gently after use | 1 | P105 |
| Care | keep dry and away from perfumes; store safely after each wear | 2 | P454, P455 |
| Care | keep dry; store in a cool, moisture-free place after use | 1 | P432 |
| Care | wipe after use; avoid chemicals, sprays and perfume; store flat; do not soak in water | 2 | P298, P299 |
| Care | wipe after use; store flat; keep sprays and perfumes away; do not soak in water; clean with a soft brush and jewelry cleaning solution | 2 | P300, P301 |
| Care Instructions | Apply perfumes and lotions before wearing; store in a dry place | 1 | P433 |
| Care Instructions | Avoid contact with water and perfumes; store in a dry place after every wear | 1 | P451 |
| Care Instructions | Avoid moisture and perfumes; store in a dry, safe place after each wear | 1 | P479 |
| Care Instructions | Avoid moisture and perfumes; store in original packaging after use | 1 | P439 |
| Care Instructions | Avoid moisture and perfumes; store safely after each wear | 1 | P474 |
| Care Instructions | Avoid moisture and perfumes; store safely in a dry place after use | 2 | P480, P488 |
| Care Instructions | Avoid water and perfumes; store in a dry, airtight container after use | 2 | P476, P494 |
| Care Instructions | Handle gently and store in a soft pouch to prevent breakage | 2 | P341, P343 |
| Care Instructions | Handle gently — these are glass bangles. | 1 | P285 |
| Care Instructions | Handle with care and store in a soft pouch to avoid breakage | 1 | P342 |
| Care Instructions | Handle with care — delicate glass bangles. | 1 | P286 |
| Care Instructions | Handle with care — these are glass bangles. | 2 | P287, P288 |
| Care Instructions | Handle with care, store in a soft pouch to avoid breakage | 1 | P340 |
| Care Instructions | Keep away from moisture and perfumes; store in a dry place after each wear | 1 | P441 |
| Care Instructions | Keep away from moisture and perfumes; store in a dry place after every wear | 2 | P448, P450 |
| Care Instructions | Keep away from moisture and perfumes; store in a dry place after use | 1 | P495 |
| Care Instructions | Keep away from moisture and perfumes; store in a dry, safe place | 1 | P437 |
| Care Instructions | Keep away from moisture and perfumes; store in a dry, safe place after each wear | 1 | P442 |
| Care Instructions | Keep away from moisture and perfumes; store safely after every wear | 2 | P483, P484 |
| Care Instructions | Keep away from moisture and store in a dry place after use | 1 | P424 |
| Care Instructions | Keep away from moisture; store in a dry, airtight place | 1 | P436 |
| Care Instructions | Keep away from water and perfumes to maintain the golden glow | 1 | P422 |
| Care Instructions | Keep away from water and perfumes; store in a dry place after each wear | 1 | P438 |
| Care Instructions | Keep away from water, perfumes and lotions; store in a dry, safe place | 1 | P434 |
| Care Instructions | Keep dry and away from perfumes; store in original packaging after use | 1 | P427 |
| Care Instructions | Keep dry; avoid contact with perfumes; store in a dry place after use | 1 | P498 |
| Care Instructions | Keep dry; avoid contact with perfumes; store safely in a dry place | 1 | P444 |
| Care Instructions | Keep dry; store safely away from perfumes and moisture | 1 | P463 |
| Care Instructions | Keep dry; store safely away from perfumes and moisture after every wear | 1 | P440 |
| Care Instructions | Keep dry; store safely away from perfumes and moisture after use | 1 | P481 |
| Care Instructions | Keep tucked away in a dry place and avoid contact with perfumes or water | 1 | P425 |
| Care Instructions | Keep tucked away in a dry place and avoid direct contact with perfumes and moisture | 1 | P426 |
| Care Instructions | Keep tucked away in a dry place; avoid direct contact with water, perfumes and sprays | 1 | P435 |
| Care Instructions | Store in a dry place and avoid contact with moisture and perfumes | 1 | P423 |
| Care Instructions | Wipe with a soft cloth after every use; store in a flat box to prevent scratches; keep away from sprays and perfumes; avoid soaking in water; clean with a soft brush dipped in jewellery cleaning solution. | 1 | P293 |
| Care instructions | Avoid contact with water and perfume. | 2 | P210, P211 |
| Care instructions | Keep away from moisture and store safely in a dry place to preserve golden luster of charms | 1 | P504 |
| Care instructions | Keep away from moisture and store safely to preserve golden luster of charms | 1 | P503 |
| Care instructions | Keep away from perfumes, water, excessive sweat, and harsh chemicals. Store in a dry place when not in use to help maintain the finish. | 2 | P622, P623 |
| Care instructions | Remove before bathing, swimming, washing hands with soap, or heavy sweating; wipe gently with a clean, dry cloth after use; avoid contact with perfume, lotion, or hand sanitizer; store in a dry place away from moisture when not worn. | 1 | P408 |
| Care instructions | Wipe with a soft cloth after every use; store in a flat box to avoid scratches; keep sprays and perfumes away; do not soak in water; clean only with a soft brush dipped in jewellery cleaning solution. | 1 | P383 |
| Chain | Adjustable snake chain | 1 | P630 |
| Chain | Curb chain, adjustable length | 1 | P633 |
| Chain | Delicate beaded chain | 1 | P629 |
| Chain | Fine link chain with layered drop design, adjustable length | 1 | P639 |
| Chain | Satellite bead chain, adjustable length | 1 | P634 |
| Chain | Snake chain, adjustable length | 1 | P638 |
| Chain | cascading ghungroo bell chains | 1 | P391 |
| Chain | delicate gold chain | 1 | P320 |
| Chain | double gold chains | 1 | P389 |
| Chain | fine chain | 1 | P399 |
| Chain | gold-tone chain | 1 | P628 |
| Chain Style | double-layer twisted snake chain | 1 | P554 |
| Chain Type | beaded snake chain | 1 | P435 |
| Chain Type | link chain | 1 | P434 |
| Chain Type | rope chain | 1 | P436 |
| Chain Type | snake chain | 2 | P427, P433 |
| Chain extension | Delicate adjustable chain extension | 1 | P623 |
| Chain finish | gold-toned | 1 | P383 |
| Chain length | 45 cm + 5 cm | 1 | P383 |
| Chain pattern | braided herringbone pattern | 1 | P549 |
| Chain style | gold bead chain | 1 | P553 |
| Chain style | wheat chain | 1 | P549 |
| Chain/Clasp | adjustable pearl-drop slider chain | 1 | P559 |
| Charm Design | lotus-shaped charms | 1 | P557 |
| Charm Design | pink tulip charms | 1 | P555 |
| Charm style | dangling ball charms | 1 | P550 |
| Charm/Tag | Morchadi "M" coin tag | 1 | P554 |
| Charm/motif | yellow lotus flower charms with green leaf accents | 1 | P390 |
| Clasp | lobster closure | 2 | P300, P301 |
| Clasp | toggle clasp | 1 | P103 |
| Clasp Type | lobster clasp | 2 | P293, P554 |
| Clasp Type | secure latch-back clasp | 2 | P571, P577 |
| Clasp Type | secure push-back stud clasp | 1 | P576 |
| Clasp type | OT (tulip-themed) toggle clasp | 1 | P523 |
| Clasp type | adjustable lobster clasp | 2 | P549, P550 |
| Clasp type | adjustable lobster clasp with branded coin tag | 1 | P553 |
| Clasp type | box clasp | 1 | P552 |
| Clasp type | lobster clasp | 1 | P528 |
| Clasp type | toggle clasp | 2 | P210, P211 |
| Closure | Adjustable Chain | 1 | P605 |
| Closure | Adjustable slider closure | 1 | P607 |
| Collection | All Occasions | 2 | P153, P166 |
| Color | dual-tone multicolor: green, yellow, pink, orange | 1 | P288 |
| Color | emerald green | 2 | P339, P343 |
| Color | gold-tone | 1 | P342 |
| Color | golden | 1 | P317 |
| Color | green, blue, maroon, orange, gold | 1 | P290 |
| Color | green, white, amber, lavender, black | 1 | P284 |
| Color | hot pink | 1 | P349 |
| Color | ivory white | 1 | P350 |
| Color | light golden transparent | 1 | P285 |
| Color | lime green | 1 | P346 |
| Color | multicolor (blue, pink, green, gold tones) | 1 | P340 |
| Color | navy blue | 1 | P344 |
| Color | olive green | 1 | P347 |
| Color | olive green (with golden sheen) | 1 | P287 |
| Color | pastel green | 1 | P289 |
| Color | pink | 1 | P312 |
| Color | red | 2 | P313, P314 |
| Color | royal blue | 1 | P341 |
| Color | royal purple | 1 | P351 |
| Color | rust orange | 1 | P348 |
| Color | transparent / clear | 1 | P345 |
| Color | transparent with golden detailing | 1 | P286 |
| Color/Material | gold-tone with pink heart charm | 1 | P364 |
| Color/design | gold with infinity charm | 1 | P384 |
| Colour | Black & White | 1 | P585 |
| Colour | bright pink | 1 | P216 |
| Colour | emerald green | 1 | P217 |
| Colour | golden | 2 | P103, P458 |
| Colour | green | 1 | P272 |
| Colour | maroon | 1 | P273 |
| Colour | multi-color | 1 | P271 |
| Colour | multicolor (pink, orange, yellow, green) | 1 | P218 |
| Colour | mustard yellow with gold bead embellishments | 1 | P352 |
| Colour | peach | 1 | P266 |
| Colour | pink and white | 2 | P269, P270 |
| Colour | red | 1 | P214 |
| Colour | rose gold | 2 | P210, P211 |
| Colour | rose gold-toned | 2 | P456, P457 |
| Colour | royal blue | 1 | P215 |
| Colour | silver | 1 | P240 |
| Colour Options | available in multiple colors | 1 | P281 |
| Colour Options | green, pink, yellow, blue, orange, peach (six hues) | 1 | P280 |
| Colour Options | yellow, green, pink, black, maroon, mint green (six hues) | 1 | P283 |
| Colour availability | Coral Pink, Ivory Cream, Lilac Purple & Champagne Beige | 1 | P591 |
| Colour availability | Magenta Pink, Ivory White & Classic Black | 1 | P590 |
| Colours | Blush Pink, Lilac Shimmer, Classic Black, Ivory White (set of 4) | 1 | P588 |
| Colours | Ivory Cream, Lilac Shimmer, Blush Rose, Champagne Beige (set of 4) | 1 | P589 |
| Construction | hand-crafted design | 1 | P315 |
| Construction | handcrafted | 2 | P313, P314 |
| Contents | 10-12 jewellery and accessory items per jar: 1 vintage watch guaranteed, 3-4 anti-tarnish jewellery items, 6-7 Korean jewellery items | 1 | P626 |
| Contents | 18-20 jewellery and accessory items per jar: 2 vintage watches guaranteed, 7-8 anti-tarnish jewellery pieces, 9-10 Korean jewellery pieces, beautifully decorated gift-ready premium jar | 1 | P627 |
| Contents | 3-4 surprise jewellery pieces per jar, mix of anti-tarnish and Korean-style jewellery | 1 | P624 |
| Contents | 8-9 surprise jewellery items per jar, mix of anti-tarnish and Korean-style pieces | 1 | P625 |
| Contents disclaimer | Contents are assorted and selected randomly; exact pieces vary from jar to jar | 1 | P624 |
| Contents disclaimer | Designs, colours and jewellery styles may vary from the images shown; every jar is curated individually so the contents will be a surprise | 1 | P626 |
| Contents disclaimer | Designs, colours and styles may vary from the images shown; each jar is curated individually so exact contents remain a surprise | 1 | P625 |
| Contents disclaimer | Designs, colours, patterns and styles may vary from the images shown; each jar is individually curated so the exact contents remain a surprise; the counts given are guaranteed categories and approximate item counts | 1 | P627 |
| Country of origin | India | 1 | P605 |
| Craftsmanship | handmade; identical pieces are rare | 1 | P353 |
| Craftsmanship Technique | meenakari (enamel) work | 1 | P558 |
| Craftsmanship Technique | meenakari (enamel) work — green | 1 | P559 |
| Customization mechanism | Replaceable locket accessories (not name/engraving personalization) | 1 | P513 |
| Design | "love" heart motif | 1 | P458 |
| Design | "love" script motif | 1 | P453 |
| Design | Anchor and Evil Eye motif | 1 | P439 |
| Design | Butterfly and Evil Eye motif | 1 | P441 |
| Design | Classic Roman numeral detailing | 1 | P610 |
| Design | Classic full-band pavé style | 1 | P184 |
| Design | Classic round centerpiece with sparkling accents | 1 | P187 |
| Design | Cute bow-knot motif with sparkling accents | 1 | P197 |
| Design | Decorative ghungroo & chain tassels | 2 | P604, P605 |
| Design | Dual band with intricate butterfly detailing | 1 | P193 |
| Design | Eiffel Tower charm design | 1 | P460 |
| Design | Elegant crossover band with heart solitaire | 1 | P199 |
| Design | Elegant dangling bead detailing | 1 | P603 |
| Design | Elegant dual design featuring floral and classic solitaire styles | 1 | P190 |
| Design | Elegant solitaire style with a refined finish | 1 | P195 |
| Design | Elegant vine and leaf motif with sparkling accents | 1 | P191 |
| Design | Evil Eye motif | 1 | P438 |
| Design | Eyelash and Evil Eye motif | 1 | P443 |
| Design | Floral cluster motif with shimmering centerpiece | 1 | P198 |
| Design | Green Meenakari with Kundan Stones | 1 | P605 |
| Design | Layered French-style bow | 1 | P590 |
| Design | Leaf-inspired band with centerpiece stone | 1 | P189 |
| Design | Long tail bow with flowing drape | 1 | P587 |
| Design | Meenakari-inspired charms | 1 | P601 |
| Design | Modern crossover infinity band with pavé accents | 1 | P182 |
| Design | Modern interlocked circle knot with pavé accents | 1 | P192 |
| Design | Modern open teardrop with elegant geometric details | 1 | P196 |
| Design | Modern rectangular bar with five sparkling stones | 1 | P185 |
| Design | Modern rectangular bar with linear stone setting | 1 | P186 |
| Design | Moebius (infinity loop) design | 1 | P399 |
| Design | Monochrome rosette design | 1 | P585 |
| Design | Nature-inspired circle ring with leaf accent | 1 | P201 |
| Design | Nature-inspired vine bracelet with red and green leaf motifs, open (adjustable) design | 1 | P521 |
| Design | Rectangle multi-row band with pavé setting | 1 | P188 |
| Design | Red meenakari detailing | 1 | P604 |
| Design | Rope-style band with crystal bar | 1 | P194 |
| Design | Rose flower pendant with crimson-colored bud | 1 | P516 |
| Design | Ship Wheel and Evil Eye motif | 1 | P440 |
| Design | Solitaire-inspired with slim studded band | 1 | P200 |
| Design | Statement double band with solitaire centerpiece | 1 | P183 |
| Design | Tree of Life and Evil Eye motif | 1 | P442 |
| Design | Tulip bud bow, Korean-style | 1 | P591 |
| Design | V-shape chevron band, fully studded | 2 | P232, P234 |
| Design | Y-shaped chain with three floral charms | 1 | P305 |
| Design | adjustable stack-style star and crystal band set | 1 | P163 |
| Design | alternating red, green, and pearl-toned drops | 1 | P320 |
| Design | aqua blue floral kada with intricate gold botanical patterns and deep blue floral centers | 1 | P511 |
| Design | ball-chain bracelet paired with beaded-strand chain bracelet, two-piece set | 1 | P470 |
| Design | ball-chain bracelet paired with twisted-link chain bracelet, two-piece set | 1 | P466 |
| Design | bamboo-inspired textured design | 1 | P497 |
| Design | bamboo-style kada | 1 | P266 |
| Design | bamboo-style kada, enamel detailing, textured | 1 | P270 |
| Design | beaded chain with starfish pendant | 1 | P306 |
| Design | beaded twisted-chain bracelet paired with box-chain bracelet, two-piece set | 1 | P469 |
| Design | black enamel with Greek key motif | 1 | P276 |
| Design | black marble enamel design | 1 | P278 |
| Design | blocked pattern | 1 | P252 |
| Design | bloom-inspired | 1 | P111 |
| Design | blossom charms with bow centerpiece | 1 | P548 |
| Design | blossom charms with bow design | 1 | P546 |
| Design | blue diamond-pattern enamel | 1 | P264 |
| Design | blue ombre enamel | 1 | P247 |
| Design | blue ombre textured enamel | 1 | P251 |
| Design | blue striped enamel | 1 | P259 |
| Design | blue wave enamel | 1 | P258 |
| Design | blush pink floral kada with red flower accents and gold-leaf engravings | 1 | P510 |
| Design | bow knot with layered band structure | 2 | P161, P209 |
| Design | broad band with abstract cut-out and crystal detailing | 1 | P227 |
| Design | chain bracelet with fruit charms (bananas, pineapple, watermelon slice) | 1 | P301 |
| Design | charm bracelet with key, lock, high-heeled shoe and heart charms | 1 | P300 |
| Design | chevron enamel kada | 1 | P273 |
| Design | circular coin pendant with intricate detailing | 1 | P298 |
| Design | classic dome silhouette with full CZ coverage | 1 | P207 |
| Design | classic halo setting with cushion-cut centerpiece | 1 | P154 |
| Design | classic solitaire band with side-studded stones | 1 | P230 |
| Design | contemporary open-band with bar and pearl elements | 1 | P164 |
| Design | criss-cross band with central solitaire-style stone | 1 | P151 |
| Design | criss-cross infinity wave, one studded one sleek | 1 | P239 |
| Design | criss-cross multiple band with stone accents | 1 | P206 |
| Design | crystal-dotted embellishments | 2 | P342, P346 |
| Design | dainty teardrop charm | 2 | P480, P488 |
| Design | daisy flower pendant with pearl center | 1 | P299 |
| Design | dazzling floral burst design | 1 | P327 |
| Design | delicate heart charm on a fine chain | 1 | P317 |
| Design | detailed ribbon (bow) pendant on a twisted chain | 1 | P429 |
| Design | diamond-cut geometric pattern with sparkling stones | 1 | P220 |
| Design | double disk motif with pavé accents | 1 | P173 |
| Design | double heart design | 1 | P311 |
| Design | double twin rectangular solitaire | 1 | P170 |
| Design | double-row band with stone detailing | 1 | P172 |
| Design | drop design | 1 | P477 |
| Design | dual-band style (plain and crystal-studded) | 1 | P226 |
| Design | dual-toned red and white enamel sections | 1 | P274 |
| Design | elegant floral pattern with curved band | 1 | P208 |
| Design | embossed pattern | 1 | P498 |
| Design | emerald green floral kada with marbled green enamel, textured gold-toned vine work and dark floral accents | 1 | P509 |
| Design | enamel kada | 1 | P272 |
| Design | enamel kada, textured accents | 1 | P271 |
| Design | enamel red Luo Shen flower motif | 1 | P508 |
| Design | engraved pattern | 1 | P495 |
| Design | floral burst design with studded band | 1 | P202 |
| Design | floral cluster nath design with drop charm | 1 | P482 |
| Design | floral enamel, intricate detailing | 1 | P269 |
| Design | floral halo motif with sparkling centerpiece | 1 | P155 |
| Design | floral nath design with teardrop drop | 1 | P485 |
| Design | flower charms with bow centerpiece | 1 | P547 |
| Design | flower stud with gold-detailed edges | 1 | P323 |
| Design | gold bead embellishments | 2 | P348, P349 |
| Design | gold detailing | 1 | P324 |
| Design | gold-toned beaded chain with sculpted ribbon (bow) pendant | 1 | P428 |
| Design | gold-toned vine design | 2 | P543, P544 |
| Design | golden dotted embellishments | 1 | P345 |
| Design | green ombre enamel | 1 | P256 |
| Design | half stone-studded curve, half plain polished end | 1 | P233 |
| Design | heart motif | 1 | P455 |
| Design | heart pattern | 1 | P107 |
| Design | heart-in-circle charm design | 1 | P450 |
| Design | heart-link chain bracelet paired with pearl-strand bracelet, two-piece set | 1 | P463 |
| Design | heartbeat/lifeline charm design | 2 | P451, P462 |
| Design | interlocking double heart motif | 1 | P454 |
| Design | interlocking heart-and-infinity motif | 1 | P459 |
| Design | intricate rose design | 1 | P291 |
| Design | knot-style band with studded stones | 1 | P203 |
| Design | link-chain bracelet paired with leaf-motif chain bracelet, two-piece set | 1 | P467 |
| Design | minimalist | 1 | P257 |
| Design | minimalist Korean-style square-cut solitaire | 1 | P328 |
| Design | modern geometric band with mixed stone setting | 1 | P165 |
| Design | monochrome block enamel design | 1 | P275 |
| Design | multi-charm chain with butterfly, heart, and floral disc charms | 1 | P307 |
| Design | multi-color bamboo-style | 2 | P250, P262 |
| Design | multi-color textured enamel | 1 | P252 |
| Design | multi-strand green beaded design interwoven with pearls | 1 | P316 |
| Design | neutral ombre enamel | 1 | P249 |
| Design | open adjustable design | 1 | P355 |
| Design | open adjustable ring with floral and star motifs | 1 | P205 |
| Design | open band with one plain and one stone-studded end | 1 | P224 |
| Design | open ring with floral and solitaire accents | 1 | P162 |
| Design | open-band | 1 | P353 |
| Design | open-heart centerpiece with solid-heart drop; Y-style | 1 | P431 |
| Design | orange floral enamel | 1 | P253 |
| Design | paperclip-link chain bracelet paired with heart-link chain bracelet, two-piece set | 1 | P468 |
| Design | pastel chevron enamel | 1 | P263 |
| Design | pearl station design — faux pearls spaced along a gold-toned chain | 1 | P430 |
| Design | pearl-strand bracelet paired with textured-link chain bracelet, two-piece set | 1 | P465 |
| Design | pink bamboo-style | 1 | P255 |
| Design | pink leaf-pattern enamel | 1 | P265 |
| Design | pink ombre enamel | 1 | P248 |
| Design | purple enamel flower pendant, painterly finish | 1 | P637 |
| Design | radiant floral pattern | 1 | P325 |
| Design | red enamel rose pendant with gold stem and leaves | 1 | P640 |
| Design | refined row of uniformly cut stones | 1 | P319 |
| Design | ribbed texture design | 1 | P494 |
| Design | rope-chain bracelet paired with box-link chain bracelet, two-piece set | 1 | P471 |
| Design | rope-chain bracelet paired with paperclip-link bracelet, two-piece set | 1 | P464 |
| Design | rosette flower design | 1 | P584 |
| Design | round evil eye charm design | 2 | P445, P446 |
| Design | seafoam green bamboo-style | 1 | P261 |
| Design | series of mini heart motifs linked seamlessly | 1 | P318 |
| Design | sleek band with shimmering stone inlay | 1 | P228 |
| Design | sleek bezel-set solitaire | 1 | P334 |
| Design | sleek wavy band with full CZ embellishment | 1 | P158 |
| Design | sleek, overlapping loop design | 1 | P277 |
| Design | spiral design | 1 | P280 |
| Design | star and square-shaped ring combo | 1 | P105 |
| Design | star-shaped design | 1 | P153 |
| Design | stylish, traditional festive design | 1 | P281 |
| Design | swirl texture design | 1 | P496 |
| Design | teardrop charm | 1 | P479 |
| Design | teardrop evil eye charm design | 1 | P444 |
| Design | teardrop frame bordered by CZ accents | 1 | P326 |
| Design | tennis bracelet design (single line of stones) | 1 | P448 |
| Design | tennis bracelet with marquise solitaire | 1 | P457 |
| Design | tennis bracelet with solitaire | 1 | P456 |
| Design | tennis bracelet with solitaire centerpiece | 1 | P474 |
| Design | textured | 1 | P262 |
| Design | textured heart pendant with beaded chain | 1 | P310 |
| Design | thin band | 1 | P356 |
| Design | treble clef charm design | 1 | P461 |
| Design | triple band wave design | 1 | P229 |
| Design | twin wave criss-cross band, fully studded with zircons | 1 | P238 |
| Design | twisted band with solitaire centerpiece and side-studded stones | 1 | P235 |
| Design | vintage-inspired bracelet watch | 1 | P620 |
| Design | winged heart lock charm design | 1 | P452 |
| Design | yellow bamboo-style | 1 | P254 |
| Design | yellow enamel | 1 | P260 |
| Design Accent | delicate gold leaf accents | 1 | P569 |
| Design Detail | concentric spiral/swirl texture on a crescent-shaped hoop | 1 | P571 |
| Design Detail | crosshatch engraving on polished gold surface | 1 | P573 |
| Design Detail | diagonal ribbed croissant texture, open C-hoop shape | 1 | P576 |
| Design Detail | diamond-shaped centrepiece with layered petal detail | 1 | P570 |
| Design Detail | large concentric spiral/swirl texture, oversized chunky hoop | 1 | P572 |
| Design Detail | oval cutout pattern, crescent moon-inspired design | 1 | P575 |
| Design Detail | raised quilted grid texture | 1 | P577 |
| Design Detail | twisted rope texture with raised heart charm | 1 | P574 |
| Design detail | Bow-inspired detailing around the dial | 1 | P616 |
| Design feature | Openable heart or round locket design | 1 | P513 |
| Design/Set Contents | two-piece bracelet combo set: crystal-studded tennis strand and flat snake chain | 1 | P472 |
| Design/Set Contents | two-piece bracelet combo set: flat snake chain and Figaro-link chain | 1 | P473 |
| Dial | Deep blue round dial | 1 | P609 |
| Dial | Emerald green dial | 1 | P611 |
| Dial | Rich red dial | 1 | P610 |
| Dial | deep red with Roman numeral detailing | 1 | P620 |
| Dial Shape | square star-shaped dial | 1 | P559 |
| Dial colour | Aqua blue | 1 | P616 |
| Dial colour | White | 2 | P615, P617 |
| Dial finish | gold-tone | 2 | P386, P392 |
| Dial finish | pearl-bordered, white | 1 | P390 |
| Dial finish | pearlescent white | 1 | P387 |
| Dial finish | white | 2 | P388, P389 |
| Dial markers | Minimalist gold hour markers and hands | 1 | P622 |
| Dial markers | Numeral hour markers | 1 | P619 |
| Dial shape | Leaf-shaped dial | 1 | P611 |
| Dial shape | Leaf-shaped oval | 1 | P617 |
| Dial shape | Oval | 2 | P613, P615 |
| Dial shape | Rectangular | 1 | P614 |
| Dial shape | Rectangular-oval | 1 | P619 |
| Dial shape | Round | 1 | P605 |
| Dial shape | Square | 1 | P621 |
| Dial shape | Unique oval-shaped dial | 1 | P610 |
| Dimensions | height 1.8 cm | 1 | P353 |
| Dual use | Doubles as a bracelet/wrist accessory when not in hair | 1 | P585 |
| Dual use | Doubles as a wrist accessory when not tying hair | 2 | P588, P589 |
| Embellishment | cascading ghungroo bells (both ends) | 1 | P388 |
| Embellishment | cascading ghungroo chains | 1 | P390 |
| Embellishment | cascading triple ghungroo chains | 1 | P393 |
| Embellishment | ghungroo bells (both ends) | 2 | P387, P392 |
| Embellishment | golden polka-dot detailing | 1 | P215 |
| Enamel technique | enamel (green) | 1 | P387 |
| Enamel technique | meenakari (dark green) | 1 | P392 |
| Enamel technique | meenakari (green) | 1 | P386 |
| Enamel technique | meenakari (red) | 1 | P388 |
| Enamel technique | meenakari (royal blue) | 1 | P391 |
| Enamel technique | meenakari (soft pink) | 1 | P393 |
| Finish | Anti-tarnish gold-tone finish | 1 | P611 |
| Finish | Anti-tarnish gold-tone finish (bracelets) | 1 | P593 |
| Finish | Anti-tarnish silver-tone finish | 1 | P609 |
| Finish | Antique Gold | 1 | P605 |
| Finish | Gold-tone finish | 1 | P610 |
| Finish | Silver-tone finish | 1 | P607 |
| Finish | anti-tarnish gold finish | 2 | P271, P272 |
| Finish | anti-tarnish silver-tone | 1 | P616 |
| Finish | anti-tarnish, waterproof | 1 | P382 |
| Finish | elegant glossy finish with stone embellishment | 1 | P287 |
| Finish | enamel | 1 | P301 |
| Finish | enamel work | 1 | P316 |
| Finish | glossy | 1 | P399 |
| Finish | glossy finish with fine stone detailing | 1 | P285 |
| Finish | gold finish | 1 | P356 |
| Finish | gold-plated, sleek finish, anti-tarnish, water-resistant | 1 | P257 |
| Finish | gold-tone | 2 | P595, P621 |
| Finish | gold-tone finish | 1 | P629 |
| Finish | hand-painted striped ends | 1 | P284 |
| Finish | high-polish silver finish | 1 | P326 |
| Finish | smooth, plain finish | 1 | P283 |
| Finish | soft shimmer finish | 1 | P347 |
| Finish | subtle shimmer, textured finish | 1 | P352 |
| Finish | textured, reflective finish | 1 | P318 |
| Finish | vibrant enamel | 1 | P250 |
| Finish/Coating | pink enamel | 2 | P527, P529 |
| Finish/Coating | red enamel | 1 | P530 |
| Finish/Coating | rose enamel | 1 | P528 |
| Fit | adjustable / comfort fit | 1 | P408 |
| Fit | adjustable band, fits most finger sizes | 1 | P170 |
| Fit | adjustable for most finger sizes | 1 | P209 |
| Fit | adjustable open band, fits most finger sizes | 1 | P156 |
| Fit | adjustable open design, fits most finger sizes | 1 | P164 |
| Fit | adjustable, fits all finger sizes | 1 | P233 |
| Fit | adjustable, fits any finger | 1 | P224 |
| Fit | adjustable, fits comfortably on most finger sizes | 1 | P162 |
| Fit | fixed size (not adjustable) | 1 | P235 |
| Fit | free size, adjustable | 1 | P163 |
| Fit | free size, adjustable, comfortable for most finger sizes | 1 | P205 |
| Fit | one size, fits most finger sizes | 1 | P178 |
| Grip | lightweight, no-damage grip suitable for all hair types | 1 | P584 |
| Hair-care benefit | Reduces frizz, breakage & tangles | 2 | P588, P589 |
| Hamper contents | 3 traditional rakhis, initial letter ring, pearl bracelet, face mask, perfume, chocolates and more | 1 | P600 |
| Hamper contents | Anti-Tarnish Gold-Tone Charm Bracelets (Set of 2 – Floral Design); D'Pary Kundan Drop Earrings – Pink Stone; Kashmiri Watch Jewellery Set – Traditional Gold-Tone; Satin Fabric Rose Hair Clip – Ivory; Marble-Effect Flower Hair Claw Clips (Set of 2 – Amber & Peach); Satin Fabric Flower Hair Clip – Yellow; Nail Polish Remover; Paper Soap Sheets; Black Velvet Box with 12 Pairs of Earrings | 1 | P593 |
| Hamper contents | Gold-Tone Rope Chain Bracelet; Ruby & Emerald Stone Necklace; Gold-Tone Twisted Hoop Earrings; Satin Scrunchie – Rose Gold; Gold-Tone Acrylic Bangle/Cuff; Hershey's Kisses – Milk Chocolate; Sunfeast Dark Fantasy Coffee Fills; Decorative Pink Flower Accent | 1 | P598 |
| Hamper contents | Halter Top, Anti-Tarnish Pearl Bracelet, Claw Clips x2, Scrunchies, Sticky Notes, Dairy Milk Silk, KitKat, Birthday Bunting + Fairy Lights | 1 | P532 |
| Hamper contents | His & Her Gold Initial Rings in red velvet box; Dairy Milk Silk; Ferrero Rocher ×3; Birthday bunting; fairy lights | 1 | P536 |
| Hamper contents | His & Her Silver Initial Rings in red box; Dairy Milk Silk; Ferrero Rocher ×2; Birthday bunting; fairy lights | 1 | P535 |
| Hamper contents | Initial Ring, Hoop Earrings, Scrunchie, Flower Clip, Chocolate | 1 | P545 |
| Hamper contents | Ruby & Crystal Pendant Necklace (Gold Tone); Multicolor Gemstone tulip Bracelet; Gold-Tone Charm anklet – Star & Flower Charms; Personalized Initial Ring (Silver Tone, Gift Box Included); Gold-Tone Hoop Earrings; Satin Rose Scrunchie – Black; Printed Satin Bow Hair Clip – Pink; Pink Hair Claw Clip; LED Fairy Light String (Decorative) | 1 | P599 |
| Hamper contents | Satin Rose Hair Ties (Set of 2); Satin Bow Hair Clip – Ivory; Satin Scrunchies (Set of 4 – Assorted Colours); Sunfeast Dark Fantasy Choco Fills; Hershey's Kisses – Hazelnut 'n' Cookies; Naliao Natural Collection Pomegranate Sheet Face Mask | 1 | P592 |
| Hamper contents | bracelet, jhumka earrings, scrunchie, rose oil face mask, wet wipes, Dairy Milk Silk and Ferrero Rocher | 1 | P534 |
| Hamper contents | crystal drop necklace & earring set (gift box included); satin rose hair ties (set of 2, pink & ivory); Sunfeast Dark Fantasy Choco Fills; Hershey's Kisses Hazelnut 'n' Cookies; Naliao rose oil face mask | 1 | P597 |
| Hamper contents | gold-tone stud & hoop earrings set (6 pairs); gold-tone textured hoop earrings; peach & pearl beaded flower charm bracelet; gold-tone twisted ring; satin fabric rose hair tie (ivory); acrylic flower hair claw clip (yellow) | 1 | P595 |
| Hamper contents | pearl beaded chain necklace; stud & hoop earrings set (6 pairs, gold tone); peach & pearl beaded flower charm bracelet; gold-tone twisted ring; satin scrunchie (ivory rose) | 1 | P596 |
| Hamper contents | pearl beaded chain necklace; stud earrings set (6 pairs, gold & silver tone); peach & pearl beaded flower charm bracelet; gold-tone twisted ring; satin scrunchie (peach); orange acrylic flower hair claw clip | 1 | P594 |
| Hamper contents | pink stone bracelet; heart necklace; bamboo hoop earrings; pearl bracelet with tulip charm; scrunchie; baby breath flowers; Dairy Milk Silk; Ferrero Rocher | 1 | P537 |
| Hamper contents | rose oil face mask; pink hair bow; 5 satin scrunchies; 4 mehndi cones; glass bangles; earrings; Dark Fantasy; Hershey's Kisses | 1 | P538 |
| Hoop Shape | open C-hoop silhouette | 1 | P576 |
| Hoop Shape | oval hoop silhouette | 1 | P574 |
| Hoop Shape | wide crescent silhouette | 1 | P577 |
| Length | 55.9 cm | 1 | P293 |
| Material | Alloy | 1 | P605 |
| Material | Organza and satin | 1 | P591 |
| Material | anti-tarnish gold base | 1 | P511 |
| Material | chain-link bracelet (base material unspecified) | 1 | P521 |
| Material | copper (leaf-shaped design elements) | 1 | P522 |
| Material | enamel (purple), flower-shaped pendant with lustrous metallic finish | 1 | P517 |
| Material | enamel (white, pearlescent finish), flower-shaped pendant with gold-toned center | 1 | P518 |
| Material | gold-finished copper | 1 | P513 |
| Material | gold-plated alloy | 1 | P328 |
| Material | gold-plated anti-tarnish stainless steel | 2 | P298, P299 |
| Material | gold-plated brass | 1 | P107 |
| Material | gold-plated copper (14K) | 1 | P526 |
| Material | gold-plated stainless steel | 2 | P300, P301 |
| Material | gold-tone detailing | 1 | P316 |
| Material | gold-tone metal alloy | 1 | P208 |
| Material | gold-tone-plated alloy | 1 | P334 |
| Material | gold-tone-plated stainless steel | 1 | P353 |
| Material | pearl drops | 1 | P316 |
| Material | rose gold-plated stainless steel | 1 | P634 |
| Material | satin fabric | 1 | P584 |
| Material | silver-plated brass | 1 | P151 |
| Material | stainless steel or brass | 1 | P229 |
| Material Property | skin-friendly | 1 | P358 |
| Material composition | 16-piece set: 12 deep purple glass bangles + 4 gold-toned ghoonghroo (bell) charm bangles | 1 | P502 |
| Material composition | 16-piece set: 12 glass bangles (lavender-toned) + 4 gold-toned ghoonghroo (bell) charm bangles | 1 | P500 |
| Material composition | 16-piece set: 12 glass bangles (sage green) + 4 gold-toned ghoonghroo (bell) charm bangles | 1 | P501 |
| Material composition | 16-piece set: 12 grey glass bangles + 4 gold-toned ghoonghroo (bell) charm bangles | 1 | P504 |
| Material composition | 16-piece set: 12 maroon glass bangles + 4 gold-toned ghoonghroo (bell) charm bangles | 1 | P503 |
| Material composition | 16-piece set: 12 pink glass bangles + 4 gold-toned ghoonghroo (bell) charm bangles | 1 | P499 |
| Material/Chain | gold chain | 1 | P557 |
| Material/Chain | gold-tone chain with gold bead accents | 1 | P555 |
| Material/Chain | multi-strand gold chain | 1 | P558 |
| Material/Finish | gold finish | 1 | P554 |
| Material/finish | gold-toned metal stem, anti-tarnish finish | 1 | P516 |
| Material/finish - chain | gold-finished copper | 1 | P524 |
| Material/finish - chain | gold-finished metal chain (base material unspecified) | 1 | P525 |
| Material/finish - chain | gold-finished snake chain (base metal unspecified) | 1 | P512 |
| Metal | gold-tone chain (plating/base metal unclear from text) | 1 | P358 |
| Metal/Finish | gold finish | 1 | P357 |
| Metal/Plating | gold-plated | 2 | P367, P368 |
| Metal/Plating | rose gold | 1 | P338 |
| Motif | cherry blossom (pink petal, spring theme) | 1 | P404 |
| Motif/decoration | hand-painted pink floral motifs | 1 | P386 |
| Movement Type | Quartz | 2 | P557, P559 |
| Net Quantity | 2 bangles (1 pair) | 1 | P281 |
| Net Quantity | set of two bangles | 1 | P283 |
| Net quantity | 1 | 2 | P298, P299 |
| Net quantity | 2-piece ring set | 1 | P105 |
| Net quantity | 3-piece set: 1 necklace and flower stud earrings | 1 | P508 |
| Net quantity | set of 12 bangles | 1 | P352 |
| Occasion | daily wear and special occasions | 1 | P453 |
| Occasion | daily wear or special occasions | 1 | P272 |
| Occasion | daily wear, casual outings, parties, gifting | 1 | P151 |
| Occasion | daily wear, office wear, parties, gifting | 1 | P334 |
| Occasion | daily wear, parties, gifting | 2 | P112, P113 |
| Occasion | everyday wear and special occasions | 1 | P455 |
| Occasion | festive celebrations; everyday wear | 1 | P510 |
| Occasion | gifting (Friendship Day, birthdays) | 2 | P594, P596 |
| Occasion | gifting (Friendship Day, birthdays, thank-you) | 1 | P595 |
| Occasion | gifting (birthdays, anniversaries) | 1 | P597 |
| Occasion | office wear, college, casual outings, festive occasions, parties, date nights, weddings and gifting | 1 | P620 |
| Occasion | weddings, haldi, festivals, celebrations | 1 | P352 |
| Package contents | 1 Bracelet Watch | 1 | P601 |
| Package contents | 1 Designer Bracelet Watch | 1 | P602 |
| Package contents | 1 Luxury Crystal Bracelet Watch | 1 | P607 |
| Package contents | 1 Traditional Bracelet Watch | 1 | P603 |
| Package contents | 1 Traditional Kundan Bracelet Watch | 1 | P604 |
| Package contents | 1 ring in a box | 1 | P353 |
| Package contents | cute quote cards included | 1 | P596 |
| Package contents | friendship-themed quote cards included, ready to gift | 1 | P594 |
| Package contents | kraft gift box with dried flower styling | 1 | P597 |
| Package contents | necklace, drop earrings, tennis bracelet | 1 | P432 |
| Package contents | white gift box with "Best Friends Forever" ribbon and "Happy Friendship Day" card | 1 | P595 |
| Packaging | Kraft gift box with dried flower fillers | 1 | P592 |
| Packaging | Pink gift box with fairy lights and printed satin bow | 1 | P599 |
| Packaging | Pink luxury gift box | 1 | P600 |
| Packaging | Signature pink gift box with satin and dried flower styling | 1 | P598 |
| Packaging | Signature pink gift box with satin ribbon closure | 1 | P593 |
| Packaging | comes in a box | 1 | P236 |
| Packaging | premium black velvet box | 2 | P230, P235 |
| Pendant | meenakari elephant pendant (green) | 1 | P390 |
| Pendant design | Initial 'A' pendant | 1 | P628 |
| Pendant design | heart-shaped aqua blue pendant, gold frame | 1 | P629 |
| Pendant dimensions | 2 cm x 2 cm (Length x Width) | 1 | P383 |
| Pendant size | Approx. 1.2cm x 0.6cm | 1 | P636 |
| Pendant size | Approx. 1.7cm x 1.3cm | 1 | P633 |
| Pendant size | Approx. 1.8cm diameter | 1 | P642 |
| Pendant size | Approx. 1.8cm x 1cm | 2 | P632, P641 |
| Pendant size | Approx. 1cm heart | 2 | P631, P634 |
| Pendant size | Approx. 1x1cm diameter | 1 | P630 |
| Pendant size | Approx. 2.2cm x 2cm | 1 | P637 |
| Pendant size | Approx. 2.5cm x 1.3cm | 1 | P640 |
| Pendant size | Approx. 2cm x 1.5cm | 1 | P635 |
| Pendant size | Approx. 3cm x 2cm | 1 | P638 |
| Pendant size | Largest charm approx. 1.5cm | 1 | P639 |
| Pendant/Design Shape | V-shaped vine pendant design | 1 | P564 |
| Pendant/Design Shape | V-shaped vine pendant design — bold yet elegant | 1 | P568 |
| Pendant/Design Shape | V-shaped vine pendant design — light and graceful | 1 | P565 |
| Pendant/Design Shape | V-shaped vine pendant design — soft and graceful | 1 | P567 |
| Pendant/Design Shape | minimalist V-shaped vine design | 1 | P566 |
| Personalization | Engravable initial letter ring | 1 | P600 |
| Personalization | Engravable initial on ring | 1 | P599 |
| Plating | 18K gold | 1 | P291 |
| Plating | 18K gold tone plated | 2 | P220, P226 |
| Plating | 18K gold tone plating | 1 | P224 |
| Plating | 18K rose gold plating | 2 | P232, P234 |
| Plating | 18k gold tone | 1 | P382 |
| Plating | gold-plated (fine) | 1 | P408 |
| Plating | gold-tone, tarnish-resistant finish | 1 | P156 |
| Plating | rose gold | 2 | P112, P113 |
| Plating | rose gold plating | 1 | P200 |
| Plating | rose gold-plated (polished) finish | 2 | P153, P166 |
| Plating | silver | 1 | P355 |
| Plating | silver plating | 1 | P198 |
| Plating | silver/rhodium-plated (high-shine) | 1 | P163 |
| Set Contents | 11 stackable rings (contemporary design) | 1 | P368 |
| Set Contents | 3 stackable finger rings | 1 | P367 |
| Set Contents | Necklace, Bracelet, and Ring (3-piece set) | 1 | P365 |
| Set Contents — Earrings | matching drop stud earrings | 1 | P569 |
| Set Contents — Necklace | gold-plated vine leaf necklace | 1 | P569 |
| Set Quantity | 12 rings (per listing title) | 1 | P338 |
| Set Quantity | set of 2 (pink & cream) | 1 | P584 |
| Set contents | 1-set necklace and earrings jewelry set with flower/leaf design | 1 | P507 |
| Set contents | Necklace and earring set | 1 | P522 |
| Set contents | Set of 2 | 1 | P585 |
| Set contents | Set of 4 | 2 | P588, P589 |
| Set includes | 1 necklace, 1 bracelet | 1 | P317 |
| Set includes | matching earrings | 1 | P315 |
| Set includes | matching earrings with square enamel design, Kundan stones and pearl danglers | 1 | P316 |
| Set includes | matching earrings with the same pink stones | 1 | P319 |
| Shape | butterfly, floral, heart | 1 | P307 |
| Shape | coin and initial | 1 | P308 |
| Shape | floral | 1 | P305 |
| Shape | heart | 2 | P310, P311 |
| Shape | key | 1 | P304 |
| Shape | rectangle with north star | 1 | P302 |
| Shape | starburst flower | 1 | P296 |
| Shape | starfish | 1 | P306 |
| Shape | textured heart with diamond | 1 | P303 |
| Size | bracelet length 17 cm, adjustable chain 5 cm | 2 | P300, P301 |
| Size | medium hoop | 1 | P573 |
| Size | size 6: 1.6 cm diameter; size 7: 1.7 cm; size 8: 1.8 cm | 1 | P353 |
| Size/Silhouette | oversized chunky hoop | 1 | P572 |
| Sizing | Adjustable (open ring, one-size-fits-most) | 1 | P513 |
| Sizing/design | Adjustable pull-chain closure, one-size-fits-most | 1 | P526 |
| Stone | amethyst-purple cubic zirconia, bar bezel setting | 1 | P636 |
| Stone | clear cubic zirconia accents | 1 | P635 |
| Stone | clear cubic zirconia heart, pavé halo setting | 1 | P634 |
| Stone | cubic zirconia (baguette-cut and round) | 1 | P165 |
| Stone | cubic zirconia (cushion-cut and round) | 1 | P154 |
| Stone | cubic zirconia (emerald-cut, with halo accent stones) | 1 | P170 |
| Stone | cubic zirconia (pavé-set) | 1 | P173 |
| Stone | cubic zirconia (round-cut) | 1 | P158 |
| Stone | cubic zirconia (round-cut, solitaire & halo setting) | 1 | P155 |
| Stone | cubic zirconia (solitaire center with side accents) | 2 | P230, P235 |
| Stone | emerald-cut clear cubic zirconia, four-prong gold setting | 1 | P641 |
| Stone | emerald-cut green cubic zirconia, four-prong gold setting | 1 | P632 |
| Stone | emerald-cut green cubic zirconia, octagon bezel setting | 1 | P633 |
| Stone | emerald-green cubic zirconia | 1 | P630 |
| Stone | faceted emerald-green cubic zirconia, beaded gold bezel setting | 1 | P631 |
| Stone | faux pearl and cubic zirconia | 1 | P205 |
| Stone | mother-of-pearl center | 1 | P642 |
| Stone | none (plain, no stone) | 1 | P229 |
| Stone | pearl | 1 | P164 |
| Stone | pink and green cubic zirconia tulip charms | 1 | P639 |
| Stone colour accents | Red & green stone embellishments | 1 | P603 |
| Stone cut | square solitaire | 1 | P552 |
| Strap | flexible ribbed bracelet strap | 1 | P620 |
| Strap type | Chain-link bracelet strap | 1 | P609 |
| Strap type | Textured link bracelet strap | 1 | P610 |
| Style | minimal yet glamorous | 2 | P112, P113 |
| Style | vintage, light-luxury | 1 | P508 |
| Style | vintage-inspired | 1 | P510 |
| Surface Finish | high-gloss finish | 1 | P575 |
| Theme | complete Eid hamper | 1 | P538 |
| Theme | premium birthday jewellery hamper | 1 | P537 |
| Treatment | Anti-tarnish | 1 | P610 |
| Type | Bracelet Watch | 1 | P605 |
| Type | Finger Ring | 2 | P153, P166 |
| Warranty | 1 month (brand owner/manufacturer) | 2 | P300, P301 |
| Weight | 1.4 g | 1 | P353 |
| Weight | 4 g | 1 | P301 |
| Weight | 5 g | 1 | P300 |
| Weight | lightweight & comfortable | 1 | P364 |
| Weight | lightweight and durable | 1 | P318 |
| Weight | lightweight and skin-friendly | 1 | P328 |
| Weight/Quality | lightweight | 1 | P338 |

