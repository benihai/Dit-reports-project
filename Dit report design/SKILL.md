---
name: dit-design
description: Use this skill to generate well-branded interfaces and assets for DIT — Design It Right, an Israeli construction supervision & inspection company. The skill covers RTL Hebrew layout, the DIT green brand color, typography (Heebo + Assistant), and the canonical site-inspection report structure (דוח סיור פיקוח). Use for production code, throwaway prototypes, or visual artifacts like mock reports, dashboards and slide decks.
user-invocable: true
---

# DIT — Design It Right · Design Skill

Read the `README.md` file in this skill folder first — it documents the brand's voice, visual foundations, color/type tokens, iconography, and the canonical report structure.

## File map
- `README.md` — full brand context, content fundamentals, visual foundations, iconography
- `colors_and_type.css` — CSS custom properties (color, type, spacing, radii, shadow, motion)
- `assets/` — logo PNG, simplified play-button mark SVG
- `preview/` — small reference cards (colors, type, spacing, components)
- `ui_kits/inspection_report/` — the canonical RTL Hebrew inspection-report UI, as both HTML + reusable JSX components

## When invoked

1. **Always import `colors_and_type.css`** at the top of any HTML you produce. It sets the RTL direction and binds every brand token.
2. **Use RTL Hebrew unless explicitly told otherwise.** All UI should be `dir="rtl"` and reading order right-to-left.
3. **Fonts**: Heebo (display/headlines, 700–800) + Assistant (body/UI, 400–600). JetBrains Mono for codes/IDs only.
4. **Color** — primary `#8CC63F` (DIT green) used sparingly for accent only; never for body text. Ink `#1A1A1A`. Urgency triad: critical `#C8321F`, medium `#D88A0C`, low `#6FA82B`.
5. **Tone** — authoritative, technical, engineering. No emoji. No exclamation marks. Reference standards (ת״י), drawings (AS-MADE), and specs explicitly.
6. **Iconography** — Lucide line icons (1.5–1.6px stroke). No emoji. Construction photography only as evidence inside findings, with a 1px frame and a small caption.

## What to deliver

- **Visual artifacts** (slides, mocks, throwaway prototypes): copy assets out of this skill, write a static HTML file, and let the user view it. Always include `colors_and_type.css`.
- **Production code**: copy the tokens (or `@import` the CSS), and follow the components in `ui_kits/inspection_report/` as a fidelity reference — don't re-design them, recreate them.

## If invoked with no other guidance

Ask the user:
1. What surface are they building? (report, dashboard, web page, slide, e-mail template…)
2. Hebrew (RTL) or English (LTR)?
3. Real data or sample/dummy?
4. Should it match the inspection-report aesthetic, or extend the system to a new product surface?

Then act as an expert designer and output an HTML artifact OR production code, depending on the need.
