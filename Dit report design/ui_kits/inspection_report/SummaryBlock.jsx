/* global React, Icon */

function SummaryBlock({ summary, nextVisit, signedBy }) {
  return (
    <section style={{
      maxWidth:794, margin:"0 auto", padding:"24px 28px 32px",
      borderTop:"2px solid #1A1A1A"
    }}>
      <h2 style={{
        margin:"0 0 14px", fontFamily:"'Heebo',sans-serif", fontWeight:800,
        fontSize:14, letterSpacing:".12em", textTransform:"uppercase", color:"#6FA82B"
      }}>סיכום והנחיות להמשך</h2>

      <p style={{
        fontFamily:"var(--font-sans)", fontSize:15, color:"#3A3A3A",
        lineHeight:1.65, margin:"0 0 18px", textWrap:"pretty"
      }}>{summary}</p>

      <div style={{
        display:"grid", gridTemplateColumns:"1fr 1fr", gap:16,
        padding:"14px 16px", background:"#F6FAEC", borderRadius:8,
        border:"1px solid #BCDE85"
      }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <Icon name="calendar" size={16} color="#6FA82B"/>
          <div>
            <div style={{ fontSize:11, color:"#6B6B6B", fontWeight:600, letterSpacing:".06em", textTransform:"uppercase" }}>מועד הסיור הבא</div>
            <div style={{ fontFamily:"'Heebo',sans-serif", fontWeight:700, fontSize:16, color:"#1A1A1A", marginTop:2 }}>{nextVisit}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <Icon name="user" size={16} color="#6FA82B"/>
          <div>
            <div style={{ fontSize:11, color:"#6B6B6B", fontWeight:600, letterSpacing:".06em", textTransform:"uppercase" }}>נחתם על ידי</div>
            <div style={{ fontFamily:"'Heebo',sans-serif", fontWeight:700, fontSize:16, color:"#1A1A1A", marginTop:2 }}>{signedBy}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
window.SummaryBlock = SummaryBlock;
