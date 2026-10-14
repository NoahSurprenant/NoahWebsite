// The dashboard's backdrop: green, as if from inside a globe ruled with longitude and latitude
// lines and covered in a mesh of irregular cells, and the orb, glowing yellow-green with translucent
// petals turning around it. Units are screen heights, origin bottom left.
export const XBOX_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_orb;      // orb centre
uniform float u_radius;  // orb radius
uniform float u_intro;   // 0 to 1 over the first moments: the orb swells in

const float PI = 3.14159265;
// How wide the view is, across the screen's longer side: a wide-angle (fisheye) lens, which is what
// makes lines away from the middle bow outwards
const float FOV = 2.0;
// Globe lines every 10 degrees; mesh cells about 4 degrees across, so this many around
const float GLOBE_STEP = PI / 18.0;
const float CELLS_AROUND = 90.0;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Distance to the nearest edge of a mesh of irregular cells (a Voronoi diagram, by Inigo Quilez's
// two-pass method), in cell units. Cells wrap around the globe: x is taken modulo CELLS_AROUND.
float meshEdge(vec2 x) {
  vec2 n = floor(x), f = fract(x);
  vec2 mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 cell = n + g;
    cell.x = mod(cell.x, CELLS_AROUND);
    vec2 r = g + 0.2 + 0.6 * hash2(cell) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
  for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 cell = n + g;
    cell.x = mod(cell.x, CELLS_AROUND);
    vec2 r = g + 0.2 + 0.6 * hash2(cell) - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.y;
  float t = u_time;

  // Standing at the centre of a globe, looking at its equator through a wide-angle lens: the
  // poles are above and below the screen, so the longitude lines run top to bottom, bowing out
  // towards the sides, and the latitude lines curve gently. Straightest in the middle.
  vec2 s = (gl_FragCoord.xy - 0.5 * u_resolution) / max(u_resolution.x, u_resolution.y);
  float theta = length(s) * FOV;
  vec2 across = s / max(length(s), 1e-5);
  vec3 dir = vec3(sin(theta) * across, -cos(theta));
  // The globe turns slowly
  float lon = atan(dir.x, -dir.z) + t * 0.025;
  float lat = asin(clamp(dir.y, -1.0, 1.0));
  // About a pixel, as an angle
  float px = FOV / max(u_resolution.x, u_resolution.y);

  // The globe lines, as angles on the sphere: longitude lines get closer towards the poles
  float latLine = abs(fract(lat / GLOBE_STEP + 0.5) - 0.5) * GLOBE_STEP;
  float lonLine = abs(fract(lon / GLOBE_STEP + 0.5) - 0.5) * GLOBE_STEP * cos(lat);
  float globeLines = 1.0 - smoothstep(px * 0.6, px * 1.8, min(latLine, lonLine));

  // The mesh, on the same globe
  float cell = 2.0 * PI / CELLS_AROUND;
  float meshLines = 1.0 - smoothstep(px * 0.4, px * 1.3, meshEdge(vec2(lon, lat) / cell) * cell * cos(lat));

  // Darker in the middle, greener towards the edges
  vec3 col = mix(vec3(0.02, 0.10, 0.015), vec3(0.06, 0.22, 0.04), smoothstep(0.05, 0.65, length(s)));
  col += vec3(0.34, 0.80, 0.22) * globeLines * 0.32;
  col += vec3(0.24, 0.62, 0.15) * meshLines * 0.26;

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
