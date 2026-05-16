# DIT — Design It Right · Design System

> מערכת עיצוב עבור **DIT — Design It Right**, חברת ניהול פרויקטים ופיקוח בנייה.
> זוהי שפת המותג שמשמשת להפקת **דוחות סיור פיקוח עליון** וממשקי הניהול הנלווים.

---

## 1. Brand context

**DIT — Design It Right** מתמחה בניהול ופיקוח בנייה. מנהל הפרויקטים מקבל מהמפקח באתר הערות שטח גולמיות (תמונות, תיאורים) וממיר אותן לדוח רשמי, סדור וייצוגי.

The product surface this system covers:

| Surface | Audience | Tone |
|---|---|---|
| **Site Inspection Report (Hebrew, RTL)** — דוח סיור פיקוח | קבלנים, יזמים, מנהלי פרויקט | Authoritative, technical, engineering. No emotional language. |
| **Internal report builder / dashboard** | מפקחים פנימיים | Operational, efficient, dense. |

### Sources used to build this system
- **Brand brief (Hebrew)** — provided by the user, dictates RTL layout, color palette (`#8CC63F` green + `#1A1A1A`), recommended fonts (Assistant / Heebo), and the canonical report structure.
- **Logo asset** — `uploads/Gemini_Generated_Image_quylopquylopquyl.png` → copied to `assets/dit-logo.png`. The "D" is rendered as a green play-button mark.
- **No external Figma / codebase was supplied.** All visual decisions below are derived from the brief + logo; flagged where assumed.

---

## 2. Repository index

```
.
├── README.md                ← you are here
├── SKILL.md                 ← cross-compatible Agent Skill description
├── colors_and_type.css      ← CSS custom properties: color, type, spacing, radii, shadow, motion
│
├── assets/
│   ├── dit-logo.png         ← full logo (transparent, green D + black IT, tagline)
│   └── dit-mark.svg         ← clean SVG re-draw of the play-button "D" mark for in-UI use
│
├── preview/                 ← Design System tab cards (700px wide)
│   ├── colors-brand.html
│   ├── colors-neutral.html
│   ├── colors-urgency.html
│   ├── type-scale.html
│   ├── type-hebrew.html
│   ├── spacing.html
│   ├── radii-shadow.html
│   ├── logo.html
│   ├── buttons.html
│   ├── badges.html
│   ├── finding-card.html
│   ├── form-fields.html
│   └── header-footer.html
│
└── ui_kits/
    └── inspection_report/
        ├── README.md
        ├── index.html             ← the report demo (RTL Hebrew)
        ├── ReportHeader.jsx
        ├── MetadataBlock.jsx
        ├── FindingCard.jsx
        ├── UrgencyBadge.jsx
        ├── SummaryBlock.jsx
        └── Toolbar.jsx
```

See **§6 UI kits** below.

---

## 3. Content fundamentals

### Voice (Hebrew, RTL)
- **Authoritative · technical · engineering**. Sentences are short, declarative, never emotional.
- **Third-person, observational** when describing findings ("נצפה...", "אותר...", "קיים פער של 8 מ"מ מתוכנית האדריכלות").
- **Imperative** when giving instructions to the contractor ("נדרש לתקן עד...", "להשלים הארקת יסוד בהתאם לת"י 1173").
- **Always reference the standard or drawing**: ת"י (Israeli Standard), תוכנית, מפרט טכני, AS-MADE, מסמך הסכם.

### Vocabulary — preferred terms
| Use | Don't use |
|---|---|
| ליקוי / ממצא | "בעיה", "תקלה" |
| נדרש / יבוצע | "כדאי", "אפשר" |
| קבלן מבצע | "החברה", "הם" |
| תוכנית אדריכלות / קונסטרוקציה | "השרטוט" |
| שרוולי תשתית, הארקת יסוד, רצפה צפה, AS-MADE | generic words |
| קריטי / בינוני / נמוך (urgency) | "דחוף מאוד" |

### Casing & punctuation
- **Hebrew body** uses standard sentence casing.
- **English terms** (AS-MADE, RFI, BOQ) stay in **ALL CAPS** when they are standard engineering abbreviations; otherwise Title Case.
- **No emoji.** Ever. Status is conveyed via colored badges (§5 Urgency) and labels.
- **No exclamation marks.** Findings end with a period.
- **Numbers**: digits, with units. Always include units (`8 מ"מ`, `2.4 מ׳`, `Ø16`).

### Sample copy

> **ממצא 03 — חריגה בעובי שכבת בטון הרזה**
> נצפה כי עובי שכבת הבטון הרזה (Lean Concrete) ביציקת הרצפה הטכנית בקומה ‎-1 הינו 4 ס"מ בלבד, בניגוד למפרט הטכני (סעיף 02.04.03) הדורש 7 ס"מ. הסטייה מהווה כשל בכיסוי הברזל ועלולה לפגוע באטימות.
>
> **הנחיה לביצוע:** יבוצע פירוק מקומי של השכבה ויציקה חוזרת בהתאם למפרט. ביצוע מחודש יתועד ב-AS-MADE ויאושר מראש על ידי המפקח.
> **דחיפות:** קריטי · **באחריות:** קבלן ראשי (אחים לוי בע"מ).

---

## 4. Visual foundations

### 4.1 Color
- **Primary** — DIT Green `#8CC63F`. Used for: section accents, primary CTA fill, the logo's "D" mark, top rule on the report header, low-urgency indicator. **Never used for body text** (legibility on white is borderline).
- **Foreground ink** — `#1A1A1A` for headlines and primary text. `#3A3A3A` for body. `#6B6B6B` for meta/labels. `#9A9A9A` for tertiary hints.
- **Surfaces** — page is plain white (`#FFFFFF`), report panels sit on `#FAFAF8` (warm off-white). Bands use `#F2F2EF`. Dark sections / footer ink `#1A1A1A`.
- **Urgency triad** — Critical `#C8321F`, Medium `#D88A0C`, Low `#6FA82B`. Each has a 12%-saturation pastel background for badges.
- **No gradients.** This is an engineering document language; flat color only.

### 4.2 Typography
- **Display & headlines**: `Heebo` (700–800).
- **Body, UI, labels**: `Assistant` (400–600).
- **Mono / IDs / codes**: `JetBrains Mono`.
- Modular scale 1.2 (`12 / 14 / 16 / 18 / 22 / 28 / 40`).
- **Line-height**: 1.55 for body, 1.35 for headings, 1.15 for the display title.
- **Hebrew first.** Latin is fallback; all UI is laid out with `direction: rtl` and reading order right→left.

### 4.3 Spacing
- 4-pt base grid: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`.
- Findings have generous vertical rhythm — each finding sits in a 24px-padded panel with 32px between findings.
- Inline gaps (label : value) are 8px; group gaps are 16–24px.

### 4.4 Backgrounds
- **Plain white pages** with optional warm off-white panels (`--bg-surface`).
- **No full-bleed photography in chrome.** Photos appear *inside* findings as evidence — always with a thin 1px border and `4px` radius.
- **No textures, no patterns, no decorative illustration.** This is a legal-grade document.

### 4.5 Borders & rules
- Hairline `1px solid #E6E6E2` is the default separator.
- Section dividers: `2px solid #1A1A1A` (a clean engineering rule).
- Brand accent: a `3px` top-bar in DIT green on the report header (the green is *always* horizontal, never as a left-only border on a card — that is an AI-slop tell we explicitly avoid).

### 4.6 Corner radii
- **2–4px** for buttons, badges, photo frames.
- **8px** for cards/panels.
- **999px / pill** for urgency badges only.
- Logo's play-button mark is the only place we use circular geometry.

### 4.7 Shadows / elevation
- 3-step system, all warm-black, all subtle.
  - `--shadow-1`: hairline lift (cards) — `0 1px 2px rgba(26,26,26,.06)`
  - `--shadow-2`: floating panels — `0 2px 8px rgba(26,26,26,.08)`
  - `--shadow-3`: menus, popovers — `0 8px 24px rgba(26,26,26,.10)`
- **No inner shadows. No glow.** Focus ring is a 3px green halo at 35% opacity.

### 4.8 Motion
- Restrained. Most interactions are simple state changes.
- Duration: `120ms` (button hover), `200ms` (panels/badges), `320ms` (modal scrim).
- Easing: `cubic-bezier(0.2, 0, 0.2, 1)` — a single standard ease.
- **No bounces, no springs.** Reports are not playful.

### 4.9 Hover / press states
- **Hover** — primary buttons darken green → `#6FA82B` and text flips to white. Ghost buttons gain a `#1A1A1A` border. Links underline.
- **Press** — `transform: translateY(1px)` on filled buttons. No size change on hover.
- **Focus** — 3px DIT-green halo (`--shadow-focus`).

### 4.10 Layout rules
- Report content is **A4-portrait safe**: max content width 794px (A4 at 96dpi).
- Three fixed elements in the report chrome: top brand rule (3px green), header band (logo + title), footer (page number + DIT credit). Body scrolls.
- Findings are vertically stacked, never side-by-side.

### 4.11 Transparency & blur
- Used **only** for the modal scrim (`rgba(26,26,26,.55)`) and the focus ring.
- No frosted-glass / backdrop-blur in chrome.

### 4.12 Imagery vibe
- Site photography is **literal, daylight-balanced, slightly desaturated** (real construction documentation, not stylized).
- Photos are always cropped to landscape 3:2 inside findings, with a 1px `#D1D1CC` frame and a tiny caption (gray, 12px).

---

## 5. Iconography

DIT does not ship a proprietary icon set. We **adopt Lucide** (CDN) as the icon system:
- Stroke-based, 1.5px stroke, 24px grid, square caps.
- Color: inherits from text. Brand-green icons only when paired with a brand-green label.
- Loaded via CDN: `https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js`.
- Substitution flagged: **no icon set was provided** by the brand. Lucide chosen because its restrained, technical line-work matches the engineering tone better than Heroicons or Material.

### Use of other glyphs
- **Emoji**: never.
- **Unicode**: limited to mathematical/engineering glyphs (`Ø`, `±`, `²`, `°`, `™`, `"` for inch, `'` for foot/minute) and Hebrew gershayim (`״`, `׳`).
- **Logo mark**: `assets/dit-logo.png` (full lockup) and `assets/dit-mark.svg` (just the green "D play-button" mark, for favicons / app-bar use).

---

## 6. UI kits

### `ui_kits/inspection_report/`
A pixel-accurate, RTL Hebrew recreation of the DIT site-inspection report, ready to be embedded in a PDF generator or rendered live in the report-builder app.

Components:
- `ReportHeader` — top green rule + logo + report title
- `MetadataBlock` — project / location / date / inspector grid
- `FindingCard` — numbered finding with title, description, photo, instruction, urgency, owner
- `UrgencyBadge` — pill with `קריטי / בינוני / נמוך`
- `SummaryBlock` — closing summary + next visit
- `Toolbar` — actions bar (print, export PDF, add finding)

See `ui_kits/inspection_report/README.md` for screen-by-screen notes.

---

## 7. Caveats

- Fonts: Assistant + Heebo are pulled from Google Fonts. If brand has licensed/hosted versions, swap the `@import` in `colors_and_type.css`.
- Icons: Lucide is a placeholder. **Confirm with brand** before shipping; swap to a custom set if one exists.
- Color palette beyond the two given colors (urgency triad, neutrals, surfaces) was derived from the brief; **all secondary colors are open to revision**.
- No real site photography was provided — placeholders in the demo show a neutral construction stock crop.
