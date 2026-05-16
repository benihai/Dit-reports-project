/* global React */

function UrgencyBadge({ level = "low", showDot = true }) {
  const map = {
    critical: { label: "קריטי",  color: "#C8321F", bg: "#FBE9E5" },
    medium:   { label: "בינוני", color: "#D88A0C", bg: "#FBEFD7" },
    low:      { label: "נמוך",   color: "#6FA82B", bg: "#EDF6DC" },
    info:     { label: "לידיעה", color: "#2A6FB8", bg: "#E4EEF8" },
  };
  const m = map[level] || map.low;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:6,
      background:m.bg, color:m.color,
      padding:"4px 12px", borderRadius:999,
      fontFamily:"var(--font-sans)", fontSize:12, fontWeight:700, letterSpacing:".02em"
    }}>
      {showDot && <span style={{width:8, height:8, borderRadius:999, background:m.color}}></span>}
      {m.label}
    </span>
  );
}
window.UrgencyBadge = UrgencyBadge;
