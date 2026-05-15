/* global React, Icon */
const { useState: useStateTB } = React;

function Toolbar({ onAdd, onExport, onPrint, findingCount = 0 }) {
  return (
    <div style={{
      position:"sticky", top:0, zIndex:10,
      background:"rgba(255,255,255,0.96)", backdropFilter:"saturate(140%) blur(6px)",
      borderBottom:"1px solid #E6E6E2"
    }}>
      <div style={{
        display:"flex", alignItems:"center", gap:14,
        maxWidth:794, margin:"0 auto", padding:"12px 28px"
      }}>
        <div style={{
          display:"flex", alignItems:"center", gap:8,
          fontFamily:"var(--font-mono)", fontSize:11, color:"#6B6B6B"
        }}>
          <span style={{
            width:8, height:8, borderRadius:999, background:"#8CC63F",
            boxShadow:"0 0 0 3px rgba(140,198,63,.25)"
          }}/>
          <span>טיוטה · {findingCount} ממצאים</span>
        </div>
        <div style={{ flex:1 }}></div>
        <button onClick={onAdd} className="dit-btn dit-btn--primary" style={{
          display:"inline-flex", alignItems:"center", gap:6
        }}><Icon name="plus" size={16}/> הוסף ממצא</button>
        <button onClick={onPrint} className="dit-btn dit-btn--ghost" style={{
          display:"inline-flex", alignItems:"center", gap:6
        }}><Icon name="print" size={16}/> הדפסה</button>
        <button onClick={onExport} className="dit-btn dit-btn--ink" style={{
          display:"inline-flex", alignItems:"center", gap:6
        }}><Icon name="download" size={16}/> ייצא PDF</button>
      </div>
    </div>
  );
}
window.Toolbar = Toolbar;
