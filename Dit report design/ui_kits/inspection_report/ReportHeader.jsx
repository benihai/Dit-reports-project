/* global React */

function ReportHeader({ title = "דוח סיור פיקוח עליון", subtitle, reportId, clientLogo, clientName }) {
  return (
    <header style={{ background:"#fff", borderBottom:"2px solid #1A1A1A" }}>
      <div style={{ height:3, background:"#8CC63F" }}></div>
      <div style={{
        display:"grid",
        gridTemplateColumns: "1fr 2fr 1fr",
        alignItems:"center", gap:18,
        padding:"22px 28px", maxWidth:794, margin:"0 auto", boxSizing:"border-box"
      }}>
        {/* DIT logo — right side in RTL flow (first grid column) */}
        <div style={{ display:"flex", justifyContent:"flex-start" }}>
          <img src="../../assets/dit-logo.png" alt="DIT — Design It Right" style={{ height:64, width:"auto", display:"block" }}/>
        </div>

        {/* Centered title */}
        <div style={{ textAlign:"center" }}>
          <div style={{
            fontFamily:"'Heebo',sans-serif", fontWeight:800, fontSize:24,
            color:"#1A1A1A", lineHeight:1.15
          }}>{title}</div>
          {subtitle && (
            <div style={{ fontFamily:"var(--font-sans)", fontSize:13, color:"#6B6B6B", marginTop:4 }}>
              {subtitle}
            </div>
          )}
          {reportId && (
            <div style={{
              fontFamily:"var(--font-mono)", fontSize:11, color:"#6B6B6B",
              letterSpacing:".06em", marginTop:6
            }}>{reportId}</div>
          )}
        </div>

        {/* Client / project logo slot — left side */}
        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          {clientLogo ? (
            <img src={clientLogo} alt={clientName || "לוגו פרויקט"} style={{ height:60, width:"auto", maxWidth:140, objectFit:"contain", display:"block" }}/>
          ) : (
            <div style={{
              width:130, height:68,
              border:"1.5px dashed #BFBFBF",
              borderRadius:6,
              background:"repeating-linear-gradient(135deg, #FAFAF8 0 8px, #F2F2EF 8px 16px)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"var(--font-mono)", fontSize:10, color:"#9A9A9A",
              letterSpacing:".04em", textAlign:"center", lineHeight:1.3, padding:4
            }}>{clientName || "לוגו פרויקט / לקוח"}</div>
          )}
        </div>
      </div>
    </header>
  );
}
window.ReportHeader = ReportHeader;
