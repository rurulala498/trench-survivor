/* ── localStorage 는 file:// 이나 쿠키 차단 시 예외를 던진다 ── */
export const store = {
  get(k: string){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k: string, v: string){ try{ localStorage.setItem(k, v); }catch(e){} }
};
