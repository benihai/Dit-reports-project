/* global React, UrgencyBadge, Icon */

function FindingCard({ index, finding }) {
  const num = String(index).padStart(2, "0");
  return (
    <article style={{
      background:"#fff", border:"1px solid #E6E6E2", borderRadius:8,
      boxShadow:"0 1px 2px rgba(26,26,26,.06)", overflow:"hidden", marginBottom:24
    }}>
      {/* head */}
      <div style={{
        display:"flex", alignItems:"center", gap:14,
        padding:"14px 18px", borderBottom:"1px solid #E6E6E2"
      }}>
        <span style={{
          fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700,
          background:"#1A1A1A", color:"#fff", padding:"4px 10px",
          borderRadius:999, letterSpacing:".04em"
        }}>ממצא {num}</span>
        <h3 style={{
          margin:0, fontFamily:"'Heebo',sans-serif", fontWeight:700,
          fontSize:18, color:"#1A1A1A", flex:1, lineHeight:1.3
        }}>{finding.title}</h3>
        <UrgencyBadge level={finding.urgency}/>
      </div>

      {/* body */}
      <div style={{
        display:"grid",
        gridTemplateColumns: finding.photo ? "1.5fr 1fr" : "1fr",
        gap:18, padding:"16px 18px"
      }}>
        <div style={{
          fontFamily:"var(--font-sans)", fontSize:14, color:"#3A3A3A",
          lineHeight:1.65, textWrap:"pretty"
        }}>
          <span>{finding.description}</span>
          {finding.instruction && (
            <span style={{ marginInlineStart:6, color:"#1A1A1A", fontWeight:600 }}>
              {finding.instruction}
            </span>
          )}
          {finding.standard && (
            <div style={{
              marginTop:10, fontFamily:"var(--font-mono)", fontSize:11,
              color:"#6B6B6B", letterSpacing:".04em"
            }}>{finding.standard}</div>
          )}
        </div>
        {finding.photo && (
          <figure style={{ margin:0 }}>
            <div style={{
              background:`#E6E6E2 url(${finding.photo}) center/cover`,
              height:160, borderRadius:4, border:"1px solid #D1D1CC"
            }}/>
            <figcaption style={{
              fontSize:11, color:"#6B6B6B", marginTop:6,
              display:"flex", alignItems:"center", gap:6
            }}>
              <Icon name="camera" size={12}/>{finding.photoCaption || "תמונת שטח"}
            </figcaption>
          </figure>
        )}
      </div>

      {/* footer */}
      <div style={{
        display:"flex", gap:24, alignItems:"center",
        padding:"12px 18px", background:"#FAFAF8", borderTop:"1px solid #E6E6E2",
        fontFamily:"var(--font-sans)", fontSize:13, color:"#6B6B6B", flexWrap:"wrap"
      }}>
        <span>באחריות: <b style={{color:"#1A1A1A"}}>{finding.owner}</b></span>
        {finding.dueDate && <>
          <span style={{color:"#D1D1CC"}}>·</span>
          <span>תאריך יעד: <b style={{color:"#1A1A1A"}}>{finding.dueDate}</b></span>
        </>}
        {finding.reference && <>
          <span style={{color:"#D1D1CC"}}>·</span>
          <span style={{fontFamily:"var(--font-mono)", fontSize:11}}>{finding.reference}</span>
        </>}
      </div>
    </article>
  );
}

function FieldRow({ k, v, accent, mono }) {
  return (
    <div style={{ display:"flex", gap:10, marginBottom:10, alignItems:"flex-start" }}>
      <span style={{
        fontFamily:"var(--font-sans)", fontSize:11, color:"#6B6B6B",
        fontWeight:600, letterSpacing:".06em", textTransform:"uppercase",
        minWidth:96, marginTop:3, flex:"0 0 auto"
      }}>{k}</span>
      <span style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: mono ? 12 : 14,
        color: accent ? "#1A1A1A" : "#3A3A3A",
        fontWeight: accent ? 600 : 400,
        lineHeight:1.55,
        borderRight: accent ? "3px solid #8CC63F" : "none",
        paddingRight: accent ? 10 : 0,
      }}>{v}</span>
    </div>
  );
}
window.FindingCard = FindingCard;
