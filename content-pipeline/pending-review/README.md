# Pending review

Files staged for a specific owner decision that is already identified and framed — the
half-step between "investigation reported" and "change executed". Each subfolder is one
pending decision, named for the product or question it belongs to, and carries its own
`README.md` stating exactly what is being decided, where the files came from (with hashes),
and what happens on approval.

Nothing in here is live, and no code reads this directory. When the owner decides, the
approved files move on through the normal workflow (e.g. into `public/products/` plus a
catalogue edit) and the subfolder is deleted; a rejected candidate is simply deleted with a
note in the relevant register or log.

Like `incoming/` and `drafts/`, image files here stay untracked (`.gitignore`); the
`README.md` files are tracked so the pending decisions themselves are visible in git.
