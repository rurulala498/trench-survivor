/* ── 사운드 (외부 파일 없이 WebAudio로 합성) ───────────── */
let AC: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
/* 이미 깨어난 컨텍스트를 좁혀서 돌려준다.
   sfx* 는 전부 `if(!AC) return;` 로 시작하므로 이 뒤에서는 null 이 아니다. */
function ac(): AudioContext { return AC as AudioContext; }
function nb(): AudioBuffer { return noiseBuf as AudioBuffer; }

export function audioInit(){
  if(AC) return;
  AC = new AudioContext();
  const n = AC.sampleRate * 0.5;
  noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for(let i=0;i<n;i++) d[i] = Math.random()*2 - 1;
}
function env(node: AudioNode, vol: number, atk: number, dec: number){
  const g = ac().createGain();
  g.gain.setValueAtTime(0, ac().currentTime);
  g.gain.linearRampToValueAtTime(vol, ac().currentTime + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, ac().currentTime + atk + dec);
  node.connect(g); g.connect(ac().destination);
  return g;
}
export function sfxShot(power: number){
  if(!AC) return;
  const src = ac().createBufferSource(); src.buffer = nb();
  const lp = ac().createBiquadFilter(); lp.type='lowpass';
  lp.frequency.setValueAtTime(3200, ac().currentTime);
  lp.frequency.exponentialRampToValueAtTime(280, ac().currentTime + 0.14);
  src.connect(lp); env(lp, 0.28, 0.001, 0.16); src.start(); src.stop(ac().currentTime + 0.2);
  const o = ac().createOscillator(); o.type='sine';
  o.frequency.setValueAtTime(150 - power*30, ac().currentTime);
  o.frequency.exponentialRampToValueAtTime(45, ac().currentTime + 0.12);
  env(o, 0.35, 0.001, 0.13); o.start(); o.stop(ac().currentTime + 0.2);
}
export function sfxClick(f: number, vol?: number){
  if(!AC) return;
  const o = ac().createOscillator(); o.type='square';
  o.frequency.setValueAtTime(f, ac().currentTime);
  env(o, vol||0.06, 0.001, 0.05); o.start(); o.stop(ac().currentTime + 0.08);
}
export function sfxHit(){
  if(!AC) return;
  const src = ac().createBufferSource(); src.buffer = nb();
  const bp = ac().createBiquadFilter(); bp.type='bandpass'; bp.frequency.value = 420;
  src.connect(bp); env(bp, 0.22, 0.001, 0.07); src.start(); src.stop(ac().currentTime + 0.1);
}
export function sfxDeath(){
  if(!AC) return;
  const o = ac().createOscillator(); o.type='sawtooth';
  o.frequency.setValueAtTime(160 + Math.random()*60, ac().currentTime);
  o.frequency.exponentialRampToValueAtTime(38, ac().currentTime + 0.32);
  const lp = ac().createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 900;
  o.connect(lp); env(lp, 0.12, 0.01, 0.32); o.start(); o.stop(ac().currentTime + 0.4);
}
export function sfxHurt(){
  if(!AC) return;
  const o = ac().createOscillator(); o.type='triangle';
  o.frequency.setValueAtTime(90, ac().currentTime);
  o.frequency.exponentialRampToValueAtTime(30, ac().currentTime + 0.3);
  env(o, 0.4, 0.005, 0.3); o.start(); o.stop(ac().currentTime + 0.4);
}
/* 참호(통나무·모래주머니)를 후려치는 둔탁한 소리 */
export function sfxThud(){
  if(!AC) return;
  const src = ac().createBufferSource(); src.buffer = nb();
  const lp = ac().createBiquadFilter(); lp.type='lowpass';
  lp.frequency.setValueAtTime(520, ac().currentTime);
  lp.frequency.exponentialRampToValueAtTime(110, ac().currentTime + 0.16);
  src.connect(lp); env(lp, 0.16, 0.002, 0.17); src.start(); src.stop(ac().currentTime + 0.25);
  const o = ac().createOscillator(); o.type='sine';
  o.frequency.setValueAtTime(96, ac().currentTime);
  o.frequency.exponentialRampToValueAtTime(52, ac().currentTime + 0.14);
  env(o, 0.2, 0.002, 0.15); o.start(); o.stop(ac().currentTime + 0.22);
}
export function sfxWave(){
  if(!AC) return;
  [0,0.16,0.32].forEach((t,i)=>setTimeout(()=>sfxClick(440 + i*160, 0.09), t*1000));
}
