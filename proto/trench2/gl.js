/* ══════════════════════════════════════════════════════════════════
   WebGL2 스프라이트 배처 + 텍스처 아틀라스

   왜 아틀라스 하나인가 —
   좀비마다 부위가 파여서 각자 다른 그림이 된다. 부위마다 텍스처를 따로
   만들면 텍스처 전환 때문에 드로우콜이 개체 수만큼 늘어난다.
   큰 아틀라스 한 장을 칸으로 나눠 쓰고, 다친 부위만 자기 칸에 다시
   써넣으면(texSubImage2D) 화면 전체가 드로우콜 한 번에 나간다.

   흰 픽셀 칸(white)을 하나 잡아두면 단색 사각형도 같은 배치로 그려진다 —
   하늘·땅·참호까지 전부 한 번에 나간다.
   ══════════════════════════════════════════════════════════════════ */

const VS = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
in vec4 a_col;
uniform vec2 u_res;
out vec2 v_uv;
out vec4 v_col;
void main(){
  vec2 p = a_pos / u_res * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  v_uv = a_uv;
  v_col = a_col;
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec4 v_col;
uniform sampler2D u_tex;
out vec4 outColor;
void main(){
  vec4 t = texture(u_tex, v_uv);
  vec4 c = t * v_col;
  if(c.a < 0.02) discard;
  outColor = c;
}`;

const ATLAS = 1024;
const MAX_QUADS = 24000;
const FLOATS_PER_VERT = 8;

function compile(gl, type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error('셰이더 컴파일 실패: ' + gl.getShaderInfoLog(s));
  return s;
}

export function createGL(canvas){
  // preserveDrawingBuffer 는 헤드리스에서 toDataURL 로 화면을 뽑기 위해 필요하다
  const gl = canvas.getContext('webgl2',
    {antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true});
  if(!gl) throw new Error('WebGL2 를 쓸 수 없습니다');

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error('프로그램 링크 실패: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);

  /* 아틀라스 — 도트라서 절대 보간하지 않는다 */
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ATLAS, ATLAS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_QUADS * 6 * FLOATS_PER_VERT * 4, gl.DYNAMIC_DRAW);
  const stride = FLOATS_PER_VERT * 4;
  const bind = (name, size, off)=>{
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
  };
  bind('a_pos', 2, 0);
  bind('a_uv',  2, 8);
  bind('a_col', 4, 16);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const buf = new Float32Array(MAX_QUADS * 6 * FLOATS_PER_VERT);
  let n = 0;                                    // 쌓인 사각형 수

  /* ── 아틀라스 칸 관리 ────────────────────────────────────────
     기본 스프라이트는 선반 방식으로 한 번만 자른다.
     다친 부위가 쓰는 칸은 전부 같은 크기라, 죽은 좀비의 칸을
     자유 목록에 돌려놓으면 그대로 재사용된다. */
  let shelfX = 0, shelfY = 0, rowH = 0;
  function alloc(w, h){
    if(shelfX + w > ATLAS){ shelfX = 0; shelfY += rowH; rowH = 0; }
    if(shelfY + h > ATLAS) throw new Error('아틀라스가 가득 찼습니다');
    const s = {
      x: shelfX, y: shelfY, w, h,
      u0: shelfX / ATLAS, v0: shelfY / ATLAS,
      u1: (shelfX + w) / ATLAS, v1: (shelfY + h) / ATLAS,
    };
    shelfX += w;
    if(h > rowH) rowH = h;
    return s;
  }
  const DYN_W = 18, DYN_H = 22;                 // 어떤 부위든 들어가는 칸
  const freeSlots = [];
  function allocDyn(){ return freeSlots.pop() || alloc(DYN_W, DYN_H); }
  function freeDyn(s){ if(s) freeSlots.push(s); }

  function upload(slot, rgba, w, h){
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, slot.x, slot.y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  }
  /* 칸 안에서 실제로 쓰는 부분만 가리키는 uv — 칸이 부위보다 클 때 쓴다 */
  function sub(slot, w, h){
    return {
      u0: slot.x / ATLAS, v0: slot.y / ATLAS,
      u1: (slot.x + w) / ATLAS, v1: (slot.y + h) / ATLAS,
    };
  }

  /* 흰 픽셀 — 단색 사각형용 */
  const white = alloc(1, 1);
  upload(white, new Uint8Array([255,255,255,255]), 1, 1);

  /* ── 사각형 쌓기 ──────────────────────────────────────────── */
  function push(x0,y0,x1,y1,x2,y2,x3,y3, u0,v0,u1,v1, r,g,b,a){
    if(n >= MAX_QUADS) return;
    let o = n * 6 * FLOATS_PER_VERT;
    const V = (x,y,u,v)=>{ buf[o++]=x; buf[o++]=y; buf[o++]=u; buf[o++]=v;
                           buf[o++]=r; buf[o++]=g; buf[o++]=b; buf[o++]=a; };
    V(x0,y0,u0,v0); V(x1,y1,u1,v0); V(x2,y2,u1,v1);
    V(x0,y0,u0,v0); V(x2,y2,u1,v1); V(x3,y3,u0,v1);
    n++;
  }
  /* 카메라 — 월드를 그릴 때만 켜고, 시점에 붙은 것(총·참호·HUD)에는 끈다.
     이게 있어야 조준을 따라 시선이 도는 1인칭으로 읽힌다. */
  let offX = 0, offY = 0;
  function setOffset(x, y){ offX = x; offY = y; }

  /* 축에 정렬된 사각형 — 도트가 흐려지지 않게 좌표를 정수로 붙인다 */
  function sprite(uv, x, y, w, h, c){
    x = Math.round(x + offX); y = Math.round(y + offY);
    w = Math.round(w); h = Math.round(h);
    push(x, y, x+w, y, x+w, y+h, x, y+h, uv.u0, uv.v0, uv.u1, uv.v1,
         c[0], c[1], c[2], c.length > 3 ? c[3] : 1);
  }
  /* 회전 사각형 — (ox,oy)는 사각형 안의 회전 중심 */
  function spriteRot(uv, x, y, w, h, ang, ox, oy, c){
    x += offX; y += offY;
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const P = (lx, ly)=>[x + (lx-ox)*cs - (ly-oy)*sn, y + (lx-ox)*sn + (ly-oy)*cs];
    const a = P(0,0), b = P(w,0), d = P(w,h), e = P(0,h);
    push(a[0],a[1], b[0],b[1], d[0],d[1], e[0],e[1], uv.u0, uv.v0, uv.u1, uv.v1,
         c[0], c[1], c[2], c.length > 3 ? c[3] : 1);
  }
  const rect = (x,y,w,h,c)=> sprite(white, x, y, w, h, c);

  function begin(w, h){
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    n = 0;
  }
  function flush(){
    if(!n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf, 0, n * 6 * FLOATS_PER_VERT);
    gl.drawArrays(gl.TRIANGLES, 0, n * 6);
    n = 0;
  }
  const quads = ()=> n;

  return {gl, alloc, allocDyn, freeDyn, upload, sub, white, setOffset,
          sprite, spriteRot, rect, begin, flush, quads, ATLAS};
}
