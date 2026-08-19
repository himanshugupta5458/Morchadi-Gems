# Catalogue data TODO — the owner's real values

**Owner:** Morchadi Gems
**Raised by:** the product copy pass, 2026-08-19 ([ADR-035](decisions/ADR-035-catalogue-content-pass.md))
**Status:** open

## What this file is

The copy pass wrote 45 long-form product descriptions and corrected every false or misleading
claim it found. It did **not** fill a single gap. Where a real measurement, a real size option
or a real product fact was missing, the copy deliberately worked around it and the gap was
recorded here instead.

Nothing on this list can be answered from inside the repository. Every item needs the owner's
actual value — a number off a piece, a stock fact, or a business decision. **Do not invent
any of it.** An invented chain length is a returns problem and a consumer-law problem, not a
copy problem.

When a value arrives, put it in the product's `specs` in `data/products.json` (or as a
selectable `options` entry where the item says so), tick the line, and note it in
`docs/progress/BUILD_LOG.md`.

## Priority items

These four are the ones costing money or blocking a listing today.

| # | Product | What is needed | Why it is first |
| --- | --- | --- | --- |
| 1 | **P043 Emerald Green Glass Bangle Set** | Bangle size **2.4 / 2.6 / 2.8** as a selectable variant option | Glass bangles cannot be adjusted or resized. Shipping one blind is the single biggest returns driver in the catalogue |
| 2 | **P042 Royal Purple Glass Bangle Set** | Bangle size **2.4 / 2.6 / 2.8** as a selectable variant option | Same product type and same spec as P043, same exposure |
| 3 | **P034 Gold Minimalist Stone Nath** | Whether the open pressure-fit hoop **requires a piercing** or suits a non-pierced nose | The first question every nath buyer asks. The description deliberately does not answer it, so the listing currently cannot |
| 4 | **P041 Kashmiri Ghungroo Bangles** | Whether the listed price covers a **pack of 4 or a pack of 8** | A pricing ambiguity a buyer hits at checkout, after they have decided to pay |

## Missing descriptions

Four products have **no approved description**. Their pre-copy-pass one-liner is still in
place, untouched, because nothing was written for them and nothing was invented in place of
it.

- [ ] **P001 Wave Band Initial Ring** — approved description
- [ ] **P022 Vintage Gold Beaded Bracelet Watch** — approved description
- [ ] **P032 Gold Peacock Nath with Pearl Drop** — approved description
- [ ] **P042 Royal Purple Glass Bangle Set** — approved description

## Per-product checklist

### Necklaces and pendants

- [ ] **P002 Teardrop Glass Locket Necklace** — chain length; locket height; whether any charms
      ship with it (the copy assumes the buyer fills it themselves)
- [ ] **P003 Heart Floating Locket with Birthstone Charms** — chain length; whether all twelve
      charms ship with every unit or the buyer selects months; whether the heart opens by hinge
      or by twist
- [ ] **P006 Floating Locket Pendant** — chain length and locket dimensions **for all four
      shapes**; whether charms are included; whether all four shapes share one price

### Rings — size

Nine rings are published as "free size" on a band the spec also calls fixed. A fixed band
cannot fit everyone, so each needs the real internal diameter or ring size published before the
listing is honest.

- [ ] **P005 Silver-Tone Initial Signet Ring** — ring diameter (fixed band); also: letters
      **A, S, X, Y** are absent from the dropdown, confirm whether they are out of stock or
      never offered
- [ ] **P009 Watch Dial Ring** — internal diameter or ring size; confirm the link band is rigid
      rather than genuinely flexible
- [ ] **P010 Mini Watch Ring** — actual size; whether the woven band has any give; whether
      Silver and Golden are the same price
- [ ] **P011 Love Knot Ring** — ring diameter (a fixed knot ring has no adjustment at all)
- [ ] **P013 Pink Baguette Stacking Ring** — ring diameter (buyers often order two of the same
      size)
- [ ] **P014 Emerald-Green Baguette Stacking Ring** — ring diameter
- [ ] **P015 Red Solitaire Thread Ring** — ring diameter (thread rings are bought in multiples)
- [ ] **P016 Pink Solitaire Thread Ring** — ring diameter
- [ ] **P017 Clear Solitaire Thread Ring** — ring diameter
- [ ] **P018 Green Solitaire Thread Ring** — ring diameter; confirm the stone reads **olive**
      rather than emerald in the listing photographs
- [ ] **P021 Rainbow Baguette Eternity Ring** — ring diameter (a full eternity band cannot be
      adjusted at all after purchase)

### Earrings — pierced-ears notice and size

All seven stud listings use push-back posts, which are **for pierced ears only**. That is not
stated anywhere a shopper reads. It is the same sentence on all seven and needs the owner's
sign-off once.

- [ ] **P024 Multicolour CZ Cluster Studs** — pierced-ears-only notice; post length; earring
      diameter
- [ ] **P025 Silver-Plated Pink Leaf Studs** — pierced-ears-only notice; length and width
- [ ] **P026 Silver-Plated Blue Floral Studs** — pierced-ears-only notice; stud diameter
- [ ] **P027 Gold-Plated Mint Green Floral Studs** — pierced-ears-only notice; stud size;
      whether the frosted finish is a **stone treatment or a surface coating** (a coating can
      wear, and the copy must not promise permanence)
- [ ] **P028 Gold-Plated Pink Flower Studs** — pierced-ears-only notice; diameter
- [ ] **P029 Delicate Pink Petal Floral Earrings** — pierced-ears-only notice; size; post length
- [ ] **P030 Gold-Plated Round CZ Studs with Square Centre** — pierced-ears-only notice;
      diameter; **what the cat's-eye centre is made from** (glass, resin or synthetic). The copy
      deliberately avoids naming it

### Nose pins

- [ ] **P031 Silver-Plated Floral Teardrop Nath** — hoop diameter; drop length; screw post gauge
- [ ] **P033 Gold Peacock Nath with Clear Stones** — hoop diameter; drop length; post gauge
- [ ] **P034 Gold Minimalist Stone Nath** — **pierced or non-pierced** (see priority items);
      hoop diameter
- [ ] **P035 Silver-Plated Floral Cluster Nath** — hoop diameter; cluster width; post gauge;
      which nostril the asymmetric design is intended for

### Watches

- [ ] **P023 Traditional Meenakari Bracelet Watch** — strap length including the extension; dial
      diameter; battery type; **water resistance rating** (buyers assume a watch survives rain
      unless told otherwise)
- [ ] **P022 Vintage Gold Beaded Bracelet Watch** — the same four, by parity: the copy pass did
      not reach this product, but its spec carries no strap length, dial diameter, battery type
      or water resistance rating either

### Bracelets and bangles

- [ ] **P036 Orange Enamel Floral Kada** — internal diameter, or the sizes available on the
      2.4 / 2.6 / 2.8 scale. A solid kada cannot be resized
- [ ] **P037 Pink Flower Bracelet** — chain length; extension length; minimum and maximum wrist
      size it fits
- [ ] **P038 Multicolour Tulip Bracelet** — exact bracelet length and fitted wrist range. The
      box clasp has **no extension**, so length is not adjustable
- [ ] **P039 Pink Tulip Bracelet** — exact bracelet length and fitted wrist range (no extension)
- [ ] **P040 Blue Tulip Bracelet** — exact bracelet length and fitted wrist range (no extension)
- [ ] **P041 Kashmiri Ghungroo Bangles** — **per-pack pricing** for 4 and for 8 (see priority
      items)
- [ ] **P042 Royal Purple Glass Bangle Set** — bangle size 2.4 / 2.6 / 2.8 as a selectable
      variant (see priority items)
- [ ] **P043 Emerald Green Glass Bangle Set** — bangle size 2.4 / 2.6 / 2.8 as a selectable
      variant (see priority items)

### Anklets

- [ ] **P044 Silver-Plated Snake Chain Ball Anklet** — anklet length; **closure type**, whether
      it clasps or slips on
- [ ] **P045 Black Evil Eye Spiral Charm Anklet** — anklet length; extension length; bead size
- [ ] **P046 Clover Charm Gold Anklet** — chain length; extension range; **whether it ships as
      one anklet or a pair** (the other two anklets are sold in twos and the copy avoids
      claiming either)

### Hair accessories

- [ ] **P047 Pink Tulip Bow Hair Clip** — clip length; bow width
- [ ] **P048 Satin Long Tail Bow Hair Clip** — bow width; **tail length**; clip size. Tail
      length is the deciding number on a long-tail bow
- [ ] **P049 Satin Scrunchies Set of Four** — whether all four colours ship in every set or the
      set is colour-selectable; whether the WhatsApp size selection happens **before or after
      payment**; whether size affects price

## Open decisions, not missing measurements

These need a call rather than a number.

- [ ] **P017 Clear Solitaire Thread Ring** — should the title read *Clear CZ Solitaire*?
      "Solitaire" on its own reads as diamond to a lot of buyers. Left as-is because a title
      change is a merchandising call, not a correction
- [ ] **Titles carrying a bare "Gold"** — P020, P022, P032, P033, P034, P046. Every one of these
      is gold-**plated** brass, alloy or steel, and the title names the metal without the
      qualifier. The same defect was corrected on the "Silver" titles (P005, P008, P031, P035,
      P044) because the copy pass explicitly flagged those; it did not flag these, so they were
      left for the owner to decide rather than renamed unilaterally. The honest forms would be
      *Gold-Tone* or *Gold-Plated*
- [ ] **P009 Watch Dial Ring and P010 Mini Watch Ring** — both names read as a working watch and
      both specs say the dial is decorative, with the hands painted in place. The metadata pass
      states "decorative" in every field so no search result or share card promises a timepiece,
      but the titles still do. Raised 2026-08-19 by [ADR-036](decisions/ADR-036-product-seo-metadata-pass.md)
- [ ] **P032 Gold Peacock Nath with Pearl Drop** — the drop is a faux pearl-look bead, per the
      spec. The description skill's own rule is that a title may not name a material the piece
      does not contain. *Pearl-Look Drop* is the honest form. Raised 2026-08-19 by ADR-036
- [ ] **P030 Gold-Plated Round CZ Studs with Square Centre** — the spec calls the centre a
      "milky cat's-eye" without saying what it is made of. Cat's-eye names a real gemstone
      effect and, in some listings, a real stone. Confirm the material so the copy can either
      name it or keep calling it a cat's-eye *effect*, which is what it says today. Raised
      2026-08-19 by ADR-036

## Products with nothing outstanding

P004, P007, P012 and P020 carry approved copy and raised no data gap.
