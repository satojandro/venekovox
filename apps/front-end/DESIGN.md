---
version: alpha
name: VenekoVox — Paper/Ink/Signal
description: Editorial protest collage. Warm paper, charcoal ink, one vermilion signal color. Analog-digital clash with a distinct visual metaphor per section.
colors:
  paper: "#F5F0E8"
  paper-raised: "#FBF9F4"
  paper-deep: "#EDE5D8"
  ink: "#1C1B18"
  ink-soft: "#4A463E"
  ink-faint: "#8A8377"
  signal: "#CB2F1F"
  signal-deep: "#B02A1E"
  halftone: "#17150F"
  ok: "#2E6E33"
  warn: "#8A5A00"
  danger: "#B02A1E"
typography:
  display:
    fontFamily: "Archivo Black, 'Arial Black', sans-serif"
    fontSize: 3.5rem
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "Archivo Black, 'Arial Black', sans-serif"
    fontSize: 2.5rem
    fontWeight: 900
    lineHeight: 1.04
    letterSpacing: "-0.015em"
  h2:
    fontFamily: "Archivo, 'Helvetica Neue', sans-serif"
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, 'Helvetica Neue', sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  mono:
    fontFamily: "'Space Mono', 'Courier New', monospace"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Space Mono', 'Courier New', monospace"
    fontSize: 0.6875rem
    fontWeight: 700
    letterSpacing: "0.14em"
rounded:
  sm: 2px
  md: 4px
  lg: 8px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 72px
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: 14px 22px
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.signal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 14px 22px
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 14px 22px
  card:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.paper-deep}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    border: "1px solid {colors.ink-faint}"
  stamp-open:
    backgroundColor: "transparent"
    textColor: "{colors.ok}"
    rounded: "{rounded.sm}"
  stamp-closed:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
---

# VenekoVox — Paper / Ink / Signal

## Overview

VenekoVox is the truth layer for civic sentiment: anonymous but verifiably human,
encrypted so it cannot be coerced, and published with evidence anyone can check.

The visual identity is **editorial protest collage**: warm paper surfaces, charcoal
ink, and a single vermilion **signal** color used only where meaning demands it.
The system is built on a deliberate clash — analog print artifacts (halftone, torn
paper, brush strokes, rubber stamps, typewriter captions) inside a precise, modern
web layout. It must read as a serious civic instrument, not a crypto dashboard and
not a "woke poster".

Anchor reference: the landing collage of a statesman at a podium with a red
redaction strip over his eyes, a crowd with raised hands, and a red brush ring —
caption "FROM ONE VOICE → TO MANY". This one image is the tone; everything after
it in that series failed because it repeated the same crowd motif. **Every section
must invent its own visual metaphor** (see Do's and Don'ts, Imagery discipline).

## Colors

- **Paper `#F5F0E8`** — the default surface. Warm, printed, physical. Light mode only.
- **Paper raised `#FBF9F4`** — cards and panels that need separation from the page.
- **Paper deep `#EDE5D8`** — inset wells, diagram backgrounds, footer bands.
- **Ink `#1C1B18`** — all headlines and primary text. Never pure black.
- **Ink soft `#4A463E`** — body text.
- **Ink faint `#8A8377`** — captions, disclaimers, metadata.
- **Signal `#CB2F1F`** — the only accent. Vermilion = redaction, censorship, the
  brush ring, the period in the wordmark, active states, and the "the regime cannot
  see you" argument. Never used decoratively.
- **Halftone `#17150F`** — monochrome collage art (people, portraits) via halftone
  dot patterns, never full-color photography.
- **OK / warn / danger** — status only. Green is "open / verified", red (same as
  signal) is "closed / denial / coercion attempted", amber is "pending".

## Typography

- **Display** — Archivo Black, tight, massive. Headlines land like protest
  placards. One line of red is allowed inside a display headline (the period, a
  key word) but only once per screen.
- **Body** — Archivo (humanist-leaning grotesque). Generous line-height, warm.
- **Mono** — Space Mono, uppercase micro-labels and proofs. Used for: eyebrows,
  evidence strings, tx hashes, timestamps, "FIGURE 01" captions under collage art,
  stamp text. Mono is the voice of _proof_.
- **Rules** — no more than four voices on a screen (display, body, mono, and
  occasionally condensed caps for badges). Type is the hierarchy; no colored boxes
  needed to create one.

## Layout & Spacing

- Asymmetric editorial grids. The hero is _not_ centered; it is a two-column
  composition (copy left, collage right, art slightly rotated).
- Generous negative space; slabs of content alternate with full-bleed paper-deep
  bands.
- Max column ~760px for reading; ~1180px for the app shell.
- Spacing scale is 4px-based; rhythm between major sections is 72–96px.

## Elevation & Depth

- Almost none. Cards are separated by **borders** (1px paper-deep) and texture,
  not shadows. A single soft shadow (`0 1px 2px rgba(28,27,24,.06)`) is the most
  any element gets.
- "Depth" comes from collage: torn-paper edges, halftone layers, the brush ring
  overlapping photographs. Physical texture substitutes for drop shadow.

## Shapes

- Restrained corners: 2–8px. Pills only for status stamps and filter chips.
- Torn-paper edges (clip-path polygon with ragged vertices) for collage panels.
- No glassmorphism, no gradients (except a permissible paper-tone radial to lift
  the hero art), no blur.

## Components

- **wordmark**: `veneko` (ink) `vox` (signal). Red mark: the `v` box outline or a
  final period. Glitch/offset effect allowed on the mark only, on hover only.
- **button-primary**: ink fill, paper text, 2px radius, uppercase mono label,
  slight press translate. Hover turns signal.
- **button-secondary**: transparent, 1px ink-faint border, ink text.
- **card**: paper-raised, 1px paper-deep border, 4px radius, mono eyebrow on top.
- **stamp**: rotated bordered mono badge (OPEN / CLOSED / VERIFIED / EVIDENCE).
- **status-dot**: 8px circle, no glow, ok/warn/danger.
- **field-note**: expandable mono footnote under a claim — plain language first,
  technical detail behind a twist. Never a wall of caveats.

## Do's and Don'ts

**Imagery discipline (the single most important rule).**

- DO give **every major block its own collage metaphor**: the hero has the
  redacted commander and crowd; the "problem" section splits into _three distinct
  artifacts_ (a censored state document with stamps; a struck-through speech
  bubble; a bot-net circuit diagram); "how it works" is a **workflow diagram**
  with arrows and numbered mono steps; the trust section uses **keypair/circuit
  schematics** and a "SEEN BY THE SYSTEM: NOTHING" ledger.
- DO mix eras and materials: vintage halftone portraits + modern circuit traces +
  diagrams + typewriter captions. Clash is the brand.
- DO use diagrams and workflows of the actual technology (zk proof pipeline, MACI
  message flow, tally verification) as editorial art, not just marketing.
- DON'T repeat the crowd-of-diverse-people collage on every section. One crowd, at
  the hero, period.
- DON'T assemble flags of many nations as decoration. A singular flag motif is
  allowed when a poll is genuinely country-specific.
- DON'T use AI-generated generic "diverse people" imagery — it reads as woke
  poster and kills the protest energy.
- DON'T use stock photos, neon, gradients, glassmorphism, or emoji as decoration.

**Copy & content.**

- DO keep copy punchy and product-specific: name the mechanisms (ZK proof,
  encrypted ballot, verified tally) in plain words, then offer depth behind a
  field note.
- DO keep the honesty notes (operator metadata vs on-chain, encrypted message
  counts ≠ votes). They are part of the trust argument.
- DON'T invent metrics, fake activity, decorative stats, or placeholder
  testimonials.

**System.**

- DO keep exactly one accent (signal). Words and layout do the emphasis.
- DO keep light mode only for now; dark is a later export, not a half-built theme.
- DO make every hit target ≥44px, real focus states, `prefers-reduced-motion`
  honored.
- DON'T fight Tailwind with blanket overrides — extend tokens into the config.
