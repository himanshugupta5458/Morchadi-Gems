# Design

## Purpose

The working reference for the visual language: what the tokens are, what each component
takes, and when to reach for which. It answers "how do I build a page that looks like the
rest of this site?"

This folder is descriptive, not decisive. The *why* behind the palette and the type pairing
lives in [ADR-004](../decisions/ADR-004-design-system.md), which is immutable. The files
here describe the current state and are updated in place whenever a token or component
changes.

## Naming convention

- `DESIGN_SYSTEM.md` — the running reference for tokens and components. Update in place.
- `IMAGES.md` — image paths, replacing placeholders with real photography, regenerating.
- `<TOPIC>.md` — additional reference for a topic large enough to stand alone
  (e.g. `MOTION.md`, `ICONOGRAPHY.md`). Screaming snake case.

## Rule

A change to `tailwind.config.ts`, to a component's props, or to the component inventory is
not complete until `DESIGN_SYSTEM.md` and the `/style-guide` route both reflect it.
