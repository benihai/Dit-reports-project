# UI Kit — Inspection Report (דוח סיור פיקוח)

The DIT site-inspection report, recreated as an RTL Hebrew HTML/JSX prototype.
Mirrors the canonical report structure defined in the brand brief.

## Files

| File | Purpose |
|---|---|
| `index.html` | Live, RTL-rendered report demo. Open it to see the full layout in context. |
| `ReportHeader.jsx` | Top brand rule + DIT logo + report title + report number |
| `MetadataBlock.jsx` | Project name, location, date, inspector, participants, purpose |
| `FindingCard.jsx` | A single numbered finding with title, description, photo placeholder, instruction, urgency, owner |
| `UrgencyBadge.jsx` | Pill badge — `קריטי / בינוני / נמוך / לידיעה` |
| `SummaryBlock.jsx` | Closing summary + next-visit date |
| `Toolbar.jsx` | Top action bar — Add finding · Export PDF · Print |

## Notes
- Layout is **A4-portrait safe**: 794px max content width, generous vertical rhythm.
- All elements are direct-edit friendly (canonical HTML, no implied closes).
- Components rely only on the design-system tokens defined in `colors_and_type.css`.
- Photos use a single neutral construction stock image as a placeholder — replace with real evidence images.
