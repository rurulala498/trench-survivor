/* ── 죽었을 때 검은 화면 대신 원인을 보여준다 ──────────── */
function showFatal(msg: string){
  const el = document.getElementById('fatal');
  if(!el) return;
  el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;'
    + 'align-items:center;justify-content:center;gap:10px;padding:40px;text-align:center;'
    + 'font-size:15px;line-height:1.7;color:#e8b4a8;background:rgba(20,6,6,.94);z-index:9';
  el.innerHTML = '<div style="font-size:22px;font-weight:700;color:#e04a3a">실행 오류</div>'
    + '<div style="color:#c9bfb4">' + String(msg).replace(/</g,'&lt;') + '</div>'
    + '<div style="font-size:13px;color:#8b98a4">브라우저를 최신 Chrome / Edge 로 열어보세요.</div>';
}
addEventListener('error', e => showFatal(e.message + '  (line ' + e.lineno + ')'));

/* ── 구형 브라우저용 roundRect 폴리필 ──────────────────── */
if(typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r){
    const k = Math.min(typeof r === 'number' ? r : 0, Math.abs(w)/2, Math.abs(h)/2);
    this.moveTo(x + k, y);
    this.arcTo(x + w, y,     x + w, y + h, k);
    this.arcTo(x + w, y + h, x,     y + h, k);
    this.arcTo(x,     y + h, x,     y,     k);
    this.arcTo(x,     y,     x + w, y,     k);
    this.closePath();
    return this;
  };
}
