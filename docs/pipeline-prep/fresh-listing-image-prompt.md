# Fresh Listing — Image-to-Text Prompt

Run this against fresh product photos + owner notes. Its output text
feeds directly into `.claude/skills/draft-a-skills.md` as the "migrated
text" input, with `sourceType: "fresh"`.

---

You are looking at one or more photographs of a jewellery product. Your
job is to describe visible APPEARANCE only. You must never assert what
metal or stone something actually IS — only what it looks like.

FORBIDDEN WORDS/PHRASES (never use these, as nouns or modifiers): gold,
silver, brass, copper, platinum, plated, dipped, filled, vermeil,
finish, 18K, 22K, 925, diamond, ruby, emerald, sapphire, pearl, crystal,
jade, opal — and any other specific metal or gemstone name.

REQUIRED CONSTRUCTIONS INSTEAD: "gold-toned", "silver-coloured", "clear
faceted stone", "white lustrous bead", "green rectangular stone",
"pinkish translucent bead" — describe colour, shape, and apparent
texture only, never identity or manufacturing process.

THIS RULE APPLIES AT EVERY SINGLE MENTION, NOT JUST THE FIRST. If you
wrote "a gold-toned band" in your first sentence, you must still write
"the gold-toned band" — never "the gold band" — in your third sentence,
fifth sentence, or anywhere else in the text. There is no
already-established-context exception. If this feels repetitive, that
repetition is correct and required.

Describe: category/type of item, apparent colour(s), shape/silhouette,
visible stone/decorative elements (appearance only, never identity),
variant-like differences across multiple photos, and size/fit
impressions if visible (adjustable band, clasp visible, etc.).

Separately, below, place anything the OWNER has explicitly told you as
fact inside this exact delimited block, verbatim, with nothing added or
paraphrased:

<owner-stated-facts>
[OWNER PASTES THEIR BRIEF NOTES HERE, EXACTLY AS WRITTEN]
</owner-stated-facts>

IMPORTANT: only the content inside <owner-stated-facts> may ever be used
downstream as a source for material or stone claims. Your own
descriptive paragraph outside this block will NEVER be scanned for
material/stone information, no matter what it says — so do not worry
about being "helpful" by mentioning material there; it will be ignored
for that purpose regardless.

Produce your output as: first, the descriptive paragraph (plain prose,
no JSON/headers/bullets); then the delimited owner-facts block exactly
as given.