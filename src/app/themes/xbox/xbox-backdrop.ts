// The dashboard's backdrop: translucent green tubes drifting in the dark, and the glowing orb with
// its swirling core. Units are screen heights, origin bottom left.
export const XBOX_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_orb;      // orb centre
uniform float u_radius;  // orb radius
uniform float u_intro;   // 0 to 1 over the first moments: the orb swells in

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

const vec3 GREEN = vec3(0.32, 0.95, 0.12);

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.y;
  float aspect = u_resolution.x / u_resolution.y;
  float t = u_time;

  // Deep green, lit from the orb
  float fromOrb = length(uv - u_orb);
  vec3 col = mix(vec3(0.03, 0.13, 0.01), vec3(0.002, 0.012, 0.0), smoothstep(0.0, 1.3, fromOrb));

  // Tubes: glassy, so bright at the edges and faint in the middle, with a soft glow around them.
  // Far ones are thinner, dimmer and slower.
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float depth = 0.35 + 0.65 * fract(fi * 0.618 + 0.3);
    float x = uv.x - aspect * 0.5;
    float y = 0.08 + fi * 0.11 + x * (0.25 - 0.06 * fi)
      + 0.07 * sin(x * (1.3 + 0.25 * fi) + t * (0.12 + 0.05 * depth) + fi * 1.7)
      + 0.06 * (fbm(vec2(x * 1.2 + t * 0.03 * depth, fi * 3.1)) - 0.5);
    float w = 0.03 * depth;
    float d = abs(uv.y - y) / w;
    float glass = smoothstep(1.0, 0.0, d) * (0.18 + 0.82 * pow(d, 6.0));
    float glow = 0.04 / (abs(d - 1.0) + 0.4);
    // A pulse of light runs along each tube
    float pulse = 0.6 + 0.4 * sin(x * 6.0 - t * (0.8 + depth) + fi * 2.3);
    col += GREEN * (glass * 0.8 + glow * 0.12) * depth * pulse;
  }

  // The orb
  float radius = u_radius * (u_intro * u_intro * (3.0 - 2.0 * u_intro)) * (1.0 + 0.015 * sin(t * 1.3));
  vec2 p = (uv - u_orb) / max(radius, 1e-4);
  float r = length(p);
  if (r < 1.0) {
    float z = sqrt(1.0 - r * r);
    vec3 n = vec3(p, z);
    // The core swirls: noise in coordinates spun faster towards the middle
    float a = atan(p.y, p.x) + t * 0.25 + (1.0 - r) * 2.5;
    vec2 q = vec2(cos(a), sin(a)) * r * 2.0;
    float swirl = fbm(q * 1.6 + vec2(t * 0.12, -t * 0.07));
    float veins = smoothstep(0.5, 0.65, fbm(q * 3.0 - t * 0.1));
    vec3 inner = mix(vec3(0.12, 0.45, 0.03), vec3(0.75, 1.0, 0.3), smoothstep(0.25, 0.75, swirl)) + veins * vec3(0.25, 0.4, 0.05);
    vec3 light = normalize(vec3(-0.4, 0.5, 0.8));
    float diffuse = 0.45 + 0.55 * max(dot(n, light), 0.0);
    float spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 30.0);
    float rim = pow(1.0 - z, 2.5);
    vec3 orb = inner * diffuse + spec * 0.7 + rim * vec3(0.7, 1.0, 0.35);
    col = mix(col, orb, smoothstep(1.0, 0.97, r));
  }
  // Its halo breathes
  float halo = (0.16 + 0.04 * sin(t * 1.4)) / (max(r - 1.0, 0.0) * 4.0 + 0.35);
  col += GREEN * halo * smoothstep(4.0, 1.0, r) * step(0.98, r) * u_intro;

  // Vignette, and fade in from black
  vec2 c = gl_FragCoord.xy / u_resolution - 0.5;
  col *= 1.0 - dot(c, c) * 0.9;
  col *= smoothstep(0.0, 0.4, u_intro);
  gl_FragColor = vec4(col, 1.0);
}
`;
