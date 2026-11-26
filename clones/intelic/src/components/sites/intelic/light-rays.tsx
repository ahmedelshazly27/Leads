"use client";

import { useEffect, useRef } from "react";

/**
 * Approximation of the source's WebGL canvas behind "Meet Nexus": slow, teal light
 * shafts sweeping diagonally from the upper left, softened by a blur layer above it.
 * The source shader itself is not public; this matches its colour, direction and pace.
 */
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

float hash(float n){ return fract(sin(n)*43758.5453); }

float ray(vec2 p, vec2 origin, vec2 dir, float seedA, float seedB, float speed){
  vec2 d = p - origin;
  float cosA = dot(normalize(d), dir);
  float a = 0.45 + 0.15*sin(dot(normalize(d), vec2(seedA)) + uTime*speed)
              + 0.25*sin(dot(normalize(d), vec2(seedB)) + uTime*speed*1.3);
  return clamp(a, 0.0, 1.0) * clamp((0.75 - length(d)) / 0.75 + 0.35, 0.0, 1.0) * smoothstep(0.55, 1.0, cosA);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y);
  float aspect = uRes.x / uRes.y;
  vec2 o1 = vec2(-0.1*aspect, 1.25);
  vec2 dir1 = normalize(vec2(0.8, -0.55));
  float r1 = ray(p, o1, dir1, 36.22, 21.11, 0.35);
  float r2 = ray(p, o1 + vec2(0.35, 0.05), normalize(vec2(0.65,-0.75)), 22.40, 18.03, 0.27);
  float bands = 0.5 + 0.5*sin((p.x*1.6 - p.y*2.4)*6.0 + uTime*0.25);
  float streak = smoothstep(0.55, 1.0, bands) * smoothstep(1.2, 0.0, p.y) * 0.35;
  float glow = smoothstep(1.4, 0.0, length((p - vec2(0.35*aspect, 0.75)) * vec2(0.6, 1.0)));
  float l = r1*1.1 + r2*0.9 + streak*r1 + glow*0.55;
  vec3 base = vec3(0.125, 0.133, 0.145);
  vec3 teal = vec3(0.16, 0.47, 0.6);
  vec3 col = mix(base, teal, clamp(l, 0.0, 1.0));
  col += vec3(0.08, 0.16, 0.2) * pow(clamp(l,0.0,1.0), 3.0);
  float vign = smoothstep(0.0, 0.25, uv.y) * smoothstep(1.0, 0.75, uv.y);
  gl_FragColor = vec4(mix(base, col, vign), 1.0);
}`;

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a,0.0,1.0); }`;

export function LightRays() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");

    let raf = 0;
    let visible = true;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvas.clientWidth * dpr * 0.5);
      canvas.height = Math.round(canvas.clientHeight * dpr * 0.5);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) raf = requestAnimationFrame(loop);
    });
    io.observe(canvas);
    const start = performance.now();
    function loop(now: number) {
      if (!gl) return;
      gl.uniform2f(uRes, canvas!.width, canvas!.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (visible) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
