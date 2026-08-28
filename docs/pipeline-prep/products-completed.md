# Products completed

The manual register of Draft A objects whose product has been published into
`data/products.json`. A row arrives here when its row leaves
[`drafts-in-progress.md`](drafts-in-progress.md); the two files should never hold the same id at
the same time.

**Nothing generates or reads this file.** Like its counterpart it is a human index over an
untracked directory — here, `content-pipeline/completed/`.

`Published Date` is the date the commit that added the product to `data/products.json` landed,
not the date the draft was finished. A product becomes real in a commit
([ADR-001](../decisions/ADR-001-tech-stack.md)), so that is the date worth recording.

`Final Name` is the product's `name` as it stands in `data/products.json`, which is often not
the reference title the draft started from — review renames things. The draft in
`content-pipeline/completed/PNNN.json` keeps the original under `sourceNotes.rawContent`.

## Register

| Product ID | Final Name | Category | Published Date |
| --- | --- | --- | --- |
| P101 | Maroon Jelly Glass Bangles | bangles | 2026-08-25 |
| P102 | Gold-Plated Love Letters Charm | pendants | 2026-08-25 |
| P103 | Golden Toggle Clasp Bracelet | bracelets | 2026-08-27 |
| P104 | Zig-Zag CZ Ring in Rosegold Plate | rings | 2026-08-25 |
| P105 | Star and Square Ring Set | rings | 2026-08-27 |
| P106 | Pear-Petal CZ Flower Ring | rings | 2026-08-24 |
| P107 | Gold-Plated Heart Pattern Ring | rings | 2026-08-27 |
| P108 | Butterfly Wing Bypass Ring | rings | 2026-08-24 |
| P109 | Oval CZ Swirl Cocktail Ring | rings | 2026-08-24 |
| P110 | Lattice Criss-Cross CZ Ring | rings | 2026-08-24 |
| P111 | Rosegold Bloom-Inspired CZ Ring | rings | 2026-08-27 |
| P112 | Rose Gold CZ Ring, Minimal Yet Glamorous | rings | 2026-08-27 |
| P113 | Adjustable Rose Gold CZ Ring | rings | 2026-08-27 |
| P115 | Beaded-Edge CZ Band Ring | rings | 2026-08-24 |
| P117 | Interlaced Crossover CZ Ring | rings | 2026-08-24 |
| P118 | Open Heart and Teardrop CZ Ring | rings | 2026-08-24 |
| P119 | Rose Gold-Plated Oval Halo Ring | rings | 2026-08-24 |
| P120 | Blooming Five-Petal CZ Ring | rings | 2026-08-24 |
| P121 | Pink-Wing Butterfly CZ Ring | rings | 2026-08-24 |
| P122 | Rose Gold-Plated CZ Solitaire Ring | rings | 2026-08-24 |
| P123 | Stacked Coil Golden Ring | rings | 2026-08-25 |
| P124 | Rosegold-Plated Star CZ Ring | rings | 2026-08-27 |
| P125 | Star CZ Ring for Gifting, Rosegold Tone | rings | 2026-08-27 |
| P126 | Rosegold-Plated Star Ring for Teens and Women | rings | 2026-08-27 |
| P130 | Lightweight Rosegold Star CZ Ring | rings | 2026-08-27 |
| P131 | Rosegold Star Ring with CZ Detailing | rings | 2026-08-27 |
| P132 | Star-Shaped CZ Ring, Rosegold Plate | rings | 2026-08-27 |
| P133 | Rosegold CZ Ring, Star Outline | rings | 2026-08-27 |
| P134 | Star CZ Ring for Festive Wear, Rosegold | rings | 2026-08-27 |
| P137 | Rosegold Star Ring, CZ Set | rings | 2026-08-27 |
| P139 | Rosegold Star Ring for Stacking | rings | 2026-08-27 |
| P140 | Star CZ Ring in Warm Rosegold | rings | 2026-08-27 |
| P143 | Rosegold-Plated Star Ring, CZ Accent | rings | 2026-08-27 |
| P145 | Star CZ Ring, Rosegold Tone | rings | 2026-08-27 |
| P147 | Star CZ Ring in Rosegold | rings | 2026-08-27 |
| P151 | Criss-Cross Solitaire Ring, Silver-Plated | rings | 2026-08-27 |
| P152 | Star CZ Ring, Rosegold Band | rings | 2026-08-27 |
| P175 | Rose Gold-Plated CZ Ring, Adjustable Band | rings | 2026-08-27 |
| P176 | Adjustable CZ Ring in Rose Gold Tone | rings | 2026-08-27 |
| P178 | Rose Gold Alternating Stone Band Ring | rings | 2026-08-27 |
| P180 | Rose Gold Emerald-Cut Halo Ring | rings | 2026-08-27 |
| P181 | Rose Gold Flower Cluster Ring | rings | 2026-08-27 |
| P204 | V-Shaped CZ Band Ring in Rose Gold | rings | 2026-08-25 |
| P212 | Wavy Glass Kangan in Six Sheer Shades | bangles | 2026-08-25 |
| P213 | Dark Rainbow Raindrop Glass Bangles | bangles | 2026-08-25 |
| P215 | Blue Raindrop Glass Bangles | bangles | 2026-08-27 |
| P216 | Pink Raindrop Glass Bangles | bangles | 2026-08-27 |
| P218 | Satrangi Glitter Glass Bangles | bangles | 2026-08-27 |
| P240 | Infinity Ring, Silver-Tone Anti-Tarnish | rings | 2026-08-27 |
| P241 | Red Enamel Greek Key Kada | bracelets | 2026-08-25 |
| P247 | Blue Ombre Enamel Kada, Gold-Plated Anti-Tarnish | bracelets | 2026-08-27 |
| P248 | Pink Ombre Enamel Kada, Gold-Plated Anti-Tarnish | bracelets | 2026-08-27 |
| P249 | Neutral Ombre Enamel Kada, Gold-Plated Anti-Tarnish | bracelets | 2026-08-27 |
| P279 | Rope-Twist Glass Kangan in Jewel Shades | bangles | 2026-08-25 |
| P282 | Deep-Wave Glass Kangan in Bold Shades | bangles | 2026-08-25 |
| P292 | Sun Rays Pendant Necklace in Gold-Plated Steel | pendants | 2026-08-25 |
| P295 | Triangle Charm Station Necklace | necklaces | 2026-08-25 |
| P299 | Daisy Pearl-Look Pendant Necklace, Gold-Plated Anti-Tarnish | pendants | 2026-08-27 |
| P300 | Key, Lock and Heart Charm Bracelet, Gold-Plated | bracelets | 2026-08-27 |
| P319 | Pink Stone Tennis Necklace and Earring Set, Silver-Plated | necklaces | 2026-08-27 |
| P320 | Gold-Plated Multicolor Drop Necklace | necklaces | 2026-08-27 |
| P321 | CZ Halo Studs with a Milky Square Centre | earrings | 2026-08-25 |
| P322 | Silver-Plated Pink Petal Flower Studs | earrings | 2026-08-25 |
| P327 | Multicolor Crystal Cluster Stud Earrings, Gold-Plated | earrings | 2026-08-27 |
| P328 | Pink Square Stone Solitaire Ring, Gold-Plated | rings | 2026-08-27 |
| P329 | Oval Black Stone Silver-Finish Ring | rings | 2026-08-27 |
| P330 | Rectangular Maroon Stone Silver-Finish Ring | rings | 2026-08-27 |
| P331 | Oval Red Stone Silver-Finish Ring | rings | 2026-08-27 |
| P332 | Square Black Stone Two-Tone Ring, Silver-Finish | rings | 2026-08-27 |
| P333 | Rectangular Green Stone Silver-Finish Ring | rings | 2026-08-27 |
| P334 | Rectangular Green Stone Ring, Gold-Tone Bezel | rings | 2026-08-27 |
| P338 | Rose Gold Rings, Set of Twelve | rings | 2026-08-27 |
| P355 | Double Rectangular Stone Open Ring, Silver-Plated | rings | 2026-08-27 |
| P356 | Thin Gold Band Ring with Clear Stones | rings | 2026-08-27 |
| P357 | Adjustable Thin Ring with Clear Stones, Gold Finish | rings | 2026-08-27 |
| P358 | Gold Solitaire Pendant Necklace, Skin-Friendly Chain | pendants | 2026-08-27 |
| P363 | Pastel Stone Stackable Rings Set | gift-hampers | 2026-08-25 |
| P372 | Green-Stone Tree Charm | pendants | 2026-08-25 |
| P373 | Wine Glass Charm | pendants | 2026-08-25 |
| P374 | Coconut Tree Charm with Green Stones | pendants | 2026-08-25 |
| P375 | Red Cherry Charm | pendants | 2026-08-25 |
| P376 | Peace Dove Charm with Olive Branch | pendants | 2026-08-25 |
| P377 | Pink Doll Charm | pendants | 2026-08-25 |
| P378 | Boy Doll Charm | pendants | 2026-08-25 |
| P379 | Mama Letters Charm | pendants | 2026-08-25 |
| P380 | Love Word Charm | pendants | 2026-08-25 |
| P381 | Green Clover Sprig Charm | pendants | 2026-08-25 |
| P385 | Kundan-Style Crown Bracelet Watch with Chand Tassels | watches | 2026-08-25 |
| P386 | Green Meenakari Floral Kundan Bracelet Watch | watches | 2026-08-27 |
| P387 | Green Enamel Kundan Square Bracelet Watch | watches | 2026-08-27 |
| P388 | Red Meenakari Tulip Kundan Bracelet Watch | watches | 2026-08-27 |
| P389 | Red Kundan Charm Bracelet Watch, Floral Pendant | watches | 2026-08-27 |
| P390 | Yellow Lotus Meenakari Bracelet Watch, Elephant Pendant | watches | 2026-08-27 |
| P391 | Blue Meenakari Polki Kundan Bracelet Watch | watches | 2026-08-27 |
| P392 | Dark Green Meenakari CZ Bracelet Watch | watches | 2026-08-27 |
| P393 | Pink Meenakari Kundan Bracelet Watch, Chand Pendant | watches | 2026-08-27 |
| P395 | Gold-Tone Vine Bracelet, Pink and Mauve Ovals | bracelets | 2026-08-25 |
| P396 | Gold-Tone Vine Bracelet in Soft Pink | bracelets | 2026-08-25 |
| P397 | Gold-Tone Vine Bracelet, Multicolour Stones | bracelets | 2026-08-25 |
| P417 | Blush Pink Glass Jelly Bangles, Set of Eight | bangles | 2026-08-27 |
| P418 | Rose Pink Glass Jelly Bangles, Set of Eight | bangles | 2026-08-27 |
| P419 | Peach Glass Jelly Bangles, Set of Eight | bangles | 2026-08-27 |
| P420 | Pistachio Green Glass Jelly Bangles, Set of Eight | bangles | 2026-08-27 |
| P421 | Caramel Glass Jelly Bangles, Set of Eight | bangles | 2026-08-27 |
| P426 | Gold-Toned Bow Pendant Necklace | necklaces | 2026-08-27 |
| P427 | Gold-Toned Snake Chain Bow Necklace | necklaces | 2026-08-27 |
| P428 | Gold-Toned Beaded Chain Bow Necklace | necklaces | 2026-08-27 |
| P429 | Textured Gold Bow Pendant Necklace | pendants | 2026-08-27 |
| P430 | Gold-Toned Pearl Station Necklace | necklaces | 2026-08-27 |
| P431 | Gold-Toned Heart Lariat Necklace | necklaces | 2026-08-27 |
| P434 | Gold-Toned Heart Pendant Necklace, Pearl-Look Centre | necklaces | 2026-08-27 |
| P435 | Gold-Toned Elongated Heart Pendant Necklace | pendants | 2026-08-27 |
| P436 | Gold-Toned Filigree Heart Pendant on Rope Chain | pendants | 2026-08-27 |
| P437 | Fan-Shaped Crystal Pendant Necklace, Gold-Toned | pendants | 2026-08-27 |
| P447 | Evil Eye Bracelet with a Stone-Set Heart | bracelets | 2026-08-25 |
| P449 | Evil Eye Bracelet with an Open Heart | bracelets | 2026-08-25 |
| P472 | Gold-Toned Crystal Tennis Bracelet & Snake Chain Combo | bracelets | 2026-08-27 |
| P473 | Gold-Toned Snake and Figaro Chain Bracelet Set | bracelets | 2026-08-27 |
| P475 | Gold-Toned Floral Nath, Red and White Stones | nose-pins | 2026-08-25 |
| P477 | Gold-Toned Halo Nath with Clear Stones | nose-pins | 2026-08-27 |
| P478 | Silver-Tone Floral Nath with White Zirconia | nose-pins | 2026-08-25 |
| P479 | Silver-Toned Halo Nath with Clear Stones | nose-pins | 2026-08-27 |
| P480 | Gold-Toned Small Cluster Nath with Teardrop Charm | nose-pins | 2026-08-27 |
| P481 | Silver-Toned Baguette Nath with Double Drop | nose-pins | 2026-08-27 |
| P482 | Gold-Toned Cluster Nath with Drop Charm | nose-pins | 2026-08-27 |
| P483 | Gold-Toned Nath with Ruby-Red and Clear Stones | nose-pins | 2026-08-27 |
| P484 | Gold-Toned Clear-Stone Nath with a Pearl-Look Drop | nose-pins | 2026-08-27 |
| P485 | Gold-Toned Floral Cluster Nath with a Clear-Stone Teardrop | nose-pins | 2026-08-27 |
| P487 | Gold-Toned Nath with Multicolour Stones | nose-pins | 2026-08-27 |
| P488 | Silver-Toned Wide Halo Nath with a Clear-Stone Teardrop | nose-pins | 2026-08-27 |
| P494 | Anti-Tarnish Ribbed Hoop Earrings | earrings | 2026-08-27 |
| P495 | Anti-Tarnish Engraved Hoop Earrings | earrings | 2026-08-27 |
| P496 | Anti-Tarnish Swirl Texture Hoop Earrings | earrings | 2026-08-27 |
| P497 | Anti-Tarnish Bamboo-Style Hoop Earrings | earrings | 2026-08-27 |
| P498 | Anti-Tarnish Embossed Hoop Earrings | earrings | 2026-08-27 |
| P499 | Pink Glass Bangle Set with Gold-Toned Ghungroo Charms | bangles | 2026-08-27 |
| P500 | Lavender Glass Bangle Set with Gold-Toned Ghungroo Charms | bangles | 2026-08-27 |
| P501 | Sage Green Glass Bangle Set with Gold-Toned Ghungroo Charms | bangles | 2026-08-27 |
| P502 | Deep Purple Glass Bangle Set with Gold-Toned Ghungroo Charms | bangles | 2026-08-27 |
| P503 | Maroon Glass Bangle Set with Gold-Toned Ghungroo Charms | bangles | 2026-08-27 |
| P504 | Grey Glass Bangle Set with Gold-Toned Ghungroo Charms | bangles | 2026-08-27 |
| P507 | Pink Flower Pendant Necklace with Stud Earrings | necklaces | 2026-08-27 |
| P508 | Blush Enamel Luo Shen Flower Necklace and Earring Set | necklaces | 2026-08-27 |
| P509 | Green Floral Enamel Kada | bracelets | 2026-08-27 |
| P510 | Pink Floral Enamel Kada | bracelets | 2026-08-27 |
| P511 | Aqua Floral Enamel Kada | bracelets | 2026-08-27 |
| P512 | Pink Tulip Pendant Necklace | pendants | 2026-08-27 |
| P513 | Heart Locket Adjustable Open Ring | rings | 2026-08-27 |
| P516 | Crimson Rose Stem Pendant Necklace | necklaces | 2026-08-27 |
| P517 | Purple Enamel Flower Pendant Necklace | pendants | 2026-08-27 |
| P518 | White Enamel Magnolia Pendant Necklace | necklaces | 2026-08-27 |
| P519 | Clear Crystal Vine Collar Necklace | necklaces | 2026-08-27 |
| P520 | Emerald-Green Stone Vine Necklace | necklaces | 2026-08-27 |
| P521 | Red and Green Leaf Vine Bracelet | bracelets | 2026-08-27 |
| P522 | Multicolour Leaf Necklace and Earring Set | necklaces | 2026-08-27 |
| P523 | Pearl-Look Tulip Toggle Clasp Bracelet | bracelets | 2026-08-27 |
| P524 | Yellow Tulip Pendant Necklace | necklaces | 2026-08-27 |
| P525 | Ruby-Red Tulip Pendant Necklace | necklaces | 2026-08-27 |
| P526 | Cat's-Eye Vine Pull Chain Bracelet | bracelets | 2026-08-27 |
| P527 | Pink Enamel Tulip Charm Bracelet | bracelets | 2026-08-27 |
| P528 | Rose Enamel Tulip Charm Bracelet | bracelets | 2026-08-27 |
| P529 | Blush Enamel Tulip Pendant Necklace | pendants | 2026-08-27 |
| P530 | Red Enamel Tulip Pendant Necklace, Anti-Tarnish | pendants | 2026-08-27 |
| P533 | Glow and Glam Birthday Hamper | gift-hampers | 2026-08-25 |
| P534 | Eid Mubarak Gift Hamper | gift-hampers | 2026-08-27 |
| P535 | Silver Initial Ring Birthday Hamper | gift-hampers | 2026-08-27 |
| P536 | Gold Initial Ring Birthday Hamper | gift-hampers | 2026-08-27 |
| P537 | Luxury Birthday Jewellery Hamper | gift-hampers | 2026-08-27 |
| P538 | Premium Eid Gift Hamper | gift-hampers | 2026-08-27 |
| P539 | Multicolour Flower Vine Bracelet, Anti-Tarnish | bracelets | 2026-08-27 |
| P545 | Birthday Hamper with Initial Ring | gift-hampers | 2026-08-27 |
| P546 | Pink Blossom Bow Bracelet | bracelets | 2026-08-27 |
| P547 | Purple Blossom Bow Bracelet | bracelets | 2026-08-27 |
| P548 | White Blossom Bow Bracelet | bracelets | 2026-08-27 |
| P549 | Anti-Tarnish Gold Wheat Chain Bracelet | bracelets | 2026-08-27 |
| P553 | Gold Bead Bracelet with Cubic Zirconia Square Stone | bracelets | 2026-08-27 |
| P557 | Lotus Kundan-Style Bracelet Watch, Ghungroo Chain | watches | 2026-08-27 |
| P558 | Meenakari Beaded Bracelet Watch, Pearl-Look Accents | watches | 2026-08-27 |
| P559 | Star-Dial Kundan Meenakari Bracelet Watch, Slider Chain | watches | 2026-08-27 |
| P564 | Red and Emerald Vine Necklace, Anti-Tarnish Gold | necklaces | 2026-08-27 |
| P565 | Lavender and Emerald Vine Necklace, Anti-Tarnish Gold | necklaces | 2026-08-27 |
| P566 | Clear CZ Vine Necklace, Anti-Tarnish Gold | necklaces | 2026-08-27 |
| P567 | Blush Pink and Emerald Vine Necklace, Anti-Tarnish Gold | necklaces | 2026-08-27 |
| P568 | Deep Purple and Emerald Vine Necklace, Anti-Tarnish Gold | necklaces | 2026-08-27 |
| P570 | Diamond Petal Fringe Hoop Earrings, Gold-Plated Steel | earrings | 2026-08-27 |
| P571 | Spiral Texture Crescent Hoop Earrings, Gold-Plated Steel | earrings | 2026-08-27 |
| P572 | Oversized Spiral Texture Hoop Earrings, Gold-Plated Steel | earrings | 2026-08-27 |
| P573 | Crosshatch Texture Hoop Earrings, Gold-Plated Steel | earrings | 2026-08-27 |
| P574 | Twisted Rope Heart Hoop Earrings, Gold-Plated Steel | earrings | 2026-08-27 |
| P575 | Crescent Moon Cutout Hoop Earrings, Gold-Plated Steel | earrings | 2026-08-27 |
| P576 | Croissant Ribbed C-Hoop Earrings, Gold-Plated Steel | earrings | 2026-08-27 |
| P577 | Quilted Grid Hoop Earrings, Gold-Plated Steel | earrings | 2026-08-27 |
| P580 | Layered Herringbone and Bead Chain Anklet | anklets | 2026-08-25 |
| P584 | Satin Rosette Hair Tie Set, Pink and Cream | hair-accessories | 2026-08-27 |
| P585 | Satin Rosette Hair Tie Set, Black and White | hair-accessories | 2026-08-27 |
| P586 | Satin Rose Hair Tie in Six Shades | hair-accessories | 2026-08-25 |
| P588 | Blush and Black Satin Scrunchie Set, Pack of Four | hair-accessories | 2026-08-27 |
| P589 | Ivory and Champagne Satin Scrunchie Set, Pack of Four | hair-accessories | 2026-08-27 |
| P591 | Tulip Bud Organza Bow Hair Clip, Four Colourways | hair-accessories | 2026-08-27 |
| P592 | Scrunchie and Chocolate Gift Hamper | gift-hampers | 2026-08-27 |
| P593 | Complete Jewellery and Accessories Gift Hamper | gift-hampers | 2026-08-27 |
| P594 | Pearl Necklace Friendship Day Hamper | gift-hampers | 2026-08-27 |
| P595 | Gold-Tone Hoop Earrings Friendship Hamper | gift-hampers | 2026-08-27 |
| P596 | Budget Friendship Day Hamper with Pearl Necklace | gift-hampers | 2026-08-27 |
| P597 | Self Care Gift Hamper with Crystal Jewellery Set | gift-hampers | 2026-08-27 |
| P598 | Birthday Jewellery Hamper with Chocolates | gift-hampers | 2026-08-27 |
| P600 | Raksha Bandhan Gift Hamper with Initial Ring | gift-hampers | 2026-08-27 |
| P601 | Rajasthani Pearl Bead Bracelet Watch | watches | 2026-08-27 |
| P603 | Antique Gold Kundan-Style Bracelet Watch | watches | 2026-08-27 |
| P606 | Floral Meenakari Bracelet Watch with Ghungroo Bells | watches | 2026-08-25 |
| P608 | Antique-Finish Meenakari Watch with Pearl-Look Drops | watches | 2026-08-25 |
| P609 | Silver-Tone Anti-Tarnish Watch, Deep Blue Dial | watches | 2026-08-27 |
| P610 | Gold-Tone Anti-Tarnish Watch, Red Oval Dial | watches | 2026-08-27 |
| P612 | Gold-Tone Bracelet Watch, Green Round Dial | watches | 2026-08-27 |
| P613 | Gold-Tone Bracelet Watch, Green Oval Dial | watches | 2026-08-27 |
| P614 | Gold-Tone Bracelet Watch, Green Rectangular Dial | watches | 2026-08-27 |
| P615 | Gold-Tone Bracelet Watch, White Oval Dial | watches | 2026-08-27 |
| P616 | Silver-Tone Mesh Bracelet Watch, Aqua Blue Dial | watches | 2026-08-27 |
| P617 | Gold-Tone Bracelet Watch, White Leaf Dial with Pearl-Look Beads | watches | 2026-08-27 |
| P619 | Gold-Tone Bracelet Watch, Emerald Green Rectangular-Oval Dial | watches | 2026-08-27 |
| P620 | Gold-Tone Bracelet Watch, Deep Red Dial with Roman Numerals | watches | 2026-08-27 |
| P621 | Gold-Tone Mesh Bracelet Watch, Green Square Dial | watches | 2026-08-27 |
| P622 | Gold-Tone Bracelet Watch, Green Dial with Cross-Bezel | watches | 2026-08-27 |
| P623 | Gold-Tone Bracelet Watch, Green Dial with Open-Oval Link Chain | watches | 2026-08-27 |
| P624 | Classic Mystery Jewellery Jar, 3-4 Surprise Pieces | gift-hampers | 2026-08-27 |
| P625 | Surprise Mystery Jewellery Jar, 8-9 Items | gift-hampers | 2026-08-27 |
| P626 | Premium Mystery Jewellery Jar, 10-12 Items with a Watch Guaranteed | gift-hampers | 2026-08-27 |
| P627 | Ultra Premium Mystery Jewellery Jar, 18-20 Items with Two Watches Guaranteed | gift-hampers | 2026-08-27 |
| P630 | Gold-Tone Heart Wreath Necklace, Emerald-Green Stones | necklaces | 2026-08-27 |
| P635 | Gold-Tone Sunburst Key Pendant Necklace, Clear Stone Accents | pendants | 2026-08-27 |
| P636 | Gold-Tone Bar Pendant Necklace, Amethyst-Purple Stone | pendants | 2026-08-27 |
| P639 | Gold-Tone Tulip Charm Necklace, Pink and Green Stones | necklaces | 2026-08-27 |
