/**
 * A full-screen fragment shader on a plain WebGL canvas, for themes whose backdrop is one shader
 * (three.js would be a 600 kB download for a single quad). The shader gets `u_time` (seconds) and
 * `u_resolution` (drawing buffer pixels), plus whatever `uniforms()` returns each frame.
 */
export class ShaderCanvas {
  readonly canvas = document.createElement('canvas');
  private readonly gl: WebGLRenderingContext | null;
  private readonly program?: WebGLProgram;
  private readonly locations = new Map<string, WebGLUniformLocation | null>();
  private resizeObserver?: ResizeObserver;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private frameId?: number;
  private last?: number;
  private time = 0;
  /** False if WebGL is missing or the shader didn't compile, so nothing is drawn */
  readonly running: boolean = false;

  /**
   * @param stillTime With reduced motion, the time the shader is frozen at
   */
  constructor(
    private readonly host: HTMLElement,
    fragmentShader: string,
    private readonly uniforms: () => Record<string, number | number[]> = () => ({}),
    private readonly stillTime = 0,
  ) {
    this.gl = this.canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!this.gl) {
      // No WebGL: the theme's CSS background shows instead
      console.warn('Shader backdrop disabled, WebGL is unavailable');
      return;
    }
    this.program = this.link(fragmentShader);
    if (!this.program) return;
    const gl = this.gl;
    // One triangle that covers the screen
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(this.program);

    this.running = true;
    host.appendChild(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.frameId = requestAnimationFrame(this.frame);
  }

  dispose() {
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
  }

  private link(fragmentShader: string) {
    const gl = this.gl!;
    const program = gl.createProgram()!;
    const shaders: [number, string][] = [
      [gl.VERTEX_SHADER, 'attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }'],
      [gl.FRAGMENT_SHADER, fragmentShader],
    ];
    for (const [type, source] of shaders) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const logs = gl.getAttachedShaders(program)?.map(s => gl.getShaderInfoLog(s)).join('\n');
      console.error('Shader backdrop failed to compile', logs, gl.getProgramInfoLog(program));
      return undefined;
    }
    return program;
  }

  private resize() {
    // Soft, fill-bound shaders: 1.5x is plenty even on HiDPI screens
    const ratio = Math.min(window.devicePixelRatio, 1.5);
    this.canvas.width = Math.max(1, Math.round(this.host.clientWidth * ratio));
    this.canvas.height = Math.max(1, Math.round(this.host.clientHeight * ratio));
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private uniform(name: string, value: number | number[]) {
    const gl = this.gl!;
    if (!this.locations.has(name)) this.locations.set(name, gl.getUniformLocation(this.program!, name));
    const location = this.locations.get(name)!;
    if (typeof value === 'number') gl.uniform1f(location, value);
    else if (value.length === 2) gl.uniform2fv(location, value);
    else gl.uniform3fv(location, value);
  }

  private frame = (now: number) => {
    // Hidden tabs don't get frames; cap the step so coming back doesn't jump
    const dt = Math.min((now - (this.last ?? now)) / 1000, 0.1);
    this.last = now;
    this.time = this.reducedMotion.matches ? this.stillTime : this.time + dt;
    this.uniform('u_time', this.time);
    this.uniform('u_resolution', [this.canvas.width, this.canvas.height]);
    for (const [name, value] of Object.entries(this.uniforms())) this.uniform(name, value);
    this.gl!.drawArrays(this.gl!.TRIANGLES, 0, 3);
    this.frameId = requestAnimationFrame(this.frame);
  };
}
