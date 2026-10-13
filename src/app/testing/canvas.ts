/** What a fake canvas context was asked to do. */
export interface CanvasCalls {
  draws: number;
  uniforms: Map<string, unknown>;
  lost: boolean;
  lines: number;
}

/**
 * jsdom has no canvas contexts. This gives every canvas a fake WebGL context (whose program links
 * or not, as asked) and a fake 2D one, both recording the calls the tests care about.
 */
export function fakeCanvas({ webgl = true, links = true } = {}): CanvasCalls {
  const calls: CanvasCalls = { draws: 0, uniforms: new Map(), lost: false, lines: 0 };
  const noop = () => {};
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, ARRAY_BUFFER: 3, STATIC_DRAW: 4, FLOAT: 5, TRIANGLES: 6, LINK_STATUS: 7,
    createProgram: () => ({}), createShader: () => ({}), createBuffer: () => ({}),
    shaderSource: noop, compileShader: noop, attachShader: noop, linkProgram: noop, useProgram: noop,
    bindBuffer: noop, bufferData: noop, enableVertexAttribArray: noop, vertexAttribPointer: noop, viewport: noop,
    getProgramParameter: () => links,
    getAttachedShaders: () => [{}],
    getShaderInfoLog: () => 'shader log',
    getProgramInfoLog: () => 'program log',
    getAttribLocation: () => 0,
    getUniformLocation: (_program: unknown, name: string) => name,
    uniform1f: (name: string, value: number) => calls.uniforms.set(name, value),
    uniform2fv: (name: string, value: number[]) => calls.uniforms.set(name, value),
    uniform3fv: (name: string, value: number[]) => calls.uniforms.set(name, value),
    drawArrays: () => calls.draws++,
    getExtension: () => ({ loseContext: () => (calls.lost = true) }),
  };
  const context2d = {
    strokeStyle: '', lineWidth: 1,
    setTransform: noop, clearRect: noop, beginPath: noop, moveTo: noop, stroke: noop,
    lineTo: () => calls.lines++,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    ((type: string) => (type === 'webgl' ? (webgl ? gl : null) : type === '2d' ? context2d : null)) as never,
  );
  return calls;
}

/**
 * Animation frames that only run when the test says, and a ResizeObserver (jsdom has neither
 * worth using). Returns `frame(time)`, which runs the callbacks waiting for the next frame.
 */
export function manualFrames() {
  let waiting = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    waiting.set(++id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => waiting.delete(handle));
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
  return {
    frame(time: number) {
      const callbacks = [...waiting.values()];
      waiting = new Map();
      callbacks.forEach(callback => callback(time));
    },
    get pending() {
      return waiting.size;
    },
  };
}
