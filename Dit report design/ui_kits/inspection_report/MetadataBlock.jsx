/* global React, Icon */

function MetadataBlock({ meta }) {
  const items = [
    { icon:"tag",      k:"שם הפרויקט",         v: meta.project },
    { icon:"map",      k:"מיקום / אתר",        v: meta.location },
    { icon:"calendar", k:"תאריך הסיור",        v: meta.date },
    { icon:"user",     k:"מפקח מטעם DIT",      v: meta.inspector },
    { icon:"users",    k:"משתתפים נוספים",     v: meta.participants },
    { icon:"check",    k:"מטרת הסיור",         v: meta.purpose },
  ];
  return (
    <section style={{
      maxWidth:794, margin:"0 auto", padding:"22px 28px 8px",
      borderBottom:"1px solid #E6E6E2"
    }}>
      <h2 style={{
        margin:"0 0 14px", fontFamily:"'Heebo',sans-serif", fontWeight:800,
        fontSize:14, letterSpacing:".12em", textTransform:"uppercase", color:"#6FA82B"
      }}>פרטי הסיור</h2>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px 32px" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
            <span style={{ color:"#9A9A9A", marginTop:2, flex:"0 0 auto" }}>
              <Icon name={it.icon} size={16} stroke={1.6}/>
            </span>
            <div style={{ minWidth:0 }}>
              <div style={{
                fontFamily:"var(--font-sans)", fontSize:11, color:"#6B6B6B",
                fontWeight:600, letterSpacing:".06em", textTransform:"uppercase", marginBottom:2
              }}>{it.k}</div>
              <div style={{
                fontFamily:"var(--font-sans)", fontSize:15, color:"#1A1A1A", fontWeight:600
              }}>{it.v || <span style={{color:"#BFBFBF", fontWeight:400}}>—</span>}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
window.MetadataBlock = MetadataBlock;
