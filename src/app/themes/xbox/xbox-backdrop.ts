// The dashboard's backdrop: green, seen from inside a tunnel of polygon mesh that slowly drifts
// towards you, and the orb, glowing yellow-green with translucent petals turning around it. Units
// are screen heights, origin bottom left.
export const XBOX_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_orb;      // orb centre
uniform float u_radius;  // orb radius
uniform float u_intro;   // 0 to 1 over the first moments: the orb swells in

const float PI = 3.14159265;
// Mesh cells around the tunnel, and along it per unit of log distance
const float AROUND = 38.0;
const float ALONG = 5.5;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Distance to the nearest cell edge of a Voronoi mesh (Inigo Quilez's two-pass method). Cells
// wrap around the tunnel: x is taken modulo AROUND.
float meshEdge(vec2 x) {
  vec2 n = floor(x), f = fract(x);
  vec2 mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 cell = n + g;
    cell.x = mod(cell.x, AROUND);
    vec2 r = g + 0.15 + 0.7 * hash2(cell) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
  for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 cell = n + g;
    cell.x = mod(cell.x, AROUND);
    vec2 r = g + 0.15 + 0.7 * hash2(cell) - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.y;
  float t = u_time;

  // The tunnel, centred a little right of the orb, as on the dashboard
  vec2 p = uv - (u_orb + vec2(0.18, 0.02));
  float r = length(p);
  float a = atan(p.y, p.x);
  vec2 tunnel = vec2((a / (2.0 * PI) + 0.5) * AROUND, log(r) * ALONG - t * 0.12);
  float edge = meshEdge(tunnel);
  // The edge distance is in cell units; a cell's size on screen grows with r
  float lines = 1.0 - smoothstep(0.0007, 0.0019, edge * r / ALONG);
  vec3 col = mix(vec3(0.03, 0.15, 0.02), vec3(0.09, 0.30, 0.05), smoothstep(0.1, 1.1, r));
  col += vec3(0.30, 0.75, 0.18) * lines * smoothstep(0.08, 0.5, r) * 0.45;

  // The orb
  float radius = u_radius * (u_intro * u_intro * (3.0 - 2.0 * u_intro));
  vec2 q = (uv - u_orb) / max(radius, 1e-4);
  float d = length(q);
  float ang = atan(q.y, q.x);

  // Translucent petals behind and around it, turning slowly, in two layers going opposite ways
  float lobes1 = pow(0.5 + 0.5 * cos(4.0 * (ang - t * 0.12)), 2.0);
  float lobes2 = pow(0.5 + 0.5 * cos(3.0 * (ang + t * 0.09) + 1.3), 3.0);
  float outer1 = 1.05 + 0.42 * lobes1;
  float outer2 = 1.0 + 0.6 * lobes2;
  float petal1 = smoothstep(outer1, outer1 - 0.03, d) * smoothstep(0.85, 0.95, d);
  float petal2 = smoothstep(outer2, outer2 - 0.03, d) * smoothstep(0.85, 0.95, d);
  float rims = smoothstep(0.05, 0.0, abs(d - outer1)) * lobes1 + smoothstep(0.05, 0.0, abs(d - outer2)) * lobes2;
  vec3 leaf = vec3(0.45, 0.85, 0.20);
  col = mix(col, leaf, (petal1 * 0.32 + petal2 * 0.22) * u_intro);
  col += vec3(0.55, 0.95, 0.35) * rims * 0.35 * u_intro;
  // A faint ring further out
  col += vec3(0.4, 0.8, 0.2) * smoothstep(0.03, 0.0, abs(d - 1.75)) * 0.25 * u_intro;

  if (d < 1.0) {
    float z = sqrt(1.0 - d * d);
    // Yellow at the heart, green towards the rim
    vec3 sphere = mix(vec3(0.97, 0.98, 0.45), vec3(0.62, 0.82, 0.16), smoothstep(0.0, 0.85, d));
    sphere = mix(sphere, vec3(0.25, 0.55, 0.08), smoothstep(0.75, 1.0, d));
    // Gloss from the top left, and a pulse of light
    vec3 n = vec3(q, z);
    float spec = pow(max(dot(n, normalize(vec3(-0.5, 0.6, 0.8))), 0.0), 24.0);
    sphere += spec * 0.35 + 0.06 * sin(t * 1.6);
    col = mix(col, sphere, smoothstep(1.0, 0.97, d));
  }
  // Its glow
  col += vec3(0.6, 0.9, 0.2) * 0.22 / (max(d - 1.0, 0.0) * 5.0 + 0.6) * step(0.98, d) * u_intro;

  // Fade in from black
  col *= smoothstep(0.0, 0.4, u_intro);
  gl_FragColor = vec4(col, 1.0);
}
`;
