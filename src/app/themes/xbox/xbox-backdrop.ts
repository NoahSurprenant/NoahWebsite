// The dashboard's backdrop: green, as if from inside a globe ruled with longitude and latitude
// lines and tiled with hexagons, and the orb: a yellow core in green glass, wrapped in curled
// glass shells. Units are screen heights, origin bottom left.
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
const float FOV = 3.1;
// Globe lines every 15 degrees; hexagons about 6 degrees across at the equator, so this many around
const float GLOBE_STEP = PI / 12.0;
const float HEXES_AROUND = 60.0;

// Distance from p to the nearest edge of a tiling of regular hexagons one unit across (flat sides
// left and right), in the same units. It repeats every unit across, so the tiling wraps around.
float hexEdge(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5;
  vec2 b = mod(p - s * 0.5, s) - s * 0.5;
  vec2 g = abs(dot(a, a) < dot(b, b) ? a : b);
  return 0.5 - max(dot(g, normalize(s)), g.x);
}

// A curled shell of glass hugging the orb: a band from radius r0, thick deep at its middle and
// tapering to nothing at its ends, centred on angle at and spanning span radians, its outer edge
// crumpled by crumple. Returns how much of it is here, and its bright outer rim.
vec2 shell(float d, float ang, float at, float span, float r0, float thick, float crumple, float t) {
  float along = (mod(ang - at + PI, 2.0 * PI) - PI) / (span * 0.5);
  if (abs(along) > 1.0) return vec2(0.0);
  float taper = 1.0 - along * along;
  // Curls a little further out towards one end
  float inner = r0 + 0.05 * along;
  float outer = inner + thick * taper + crumple * sin(along * 9.0 + t) * taper;
  float fill = smoothstep(inner - 0.02, inner + 0.02, d) * smoothstep(outer + 0.02, outer - 0.02, d);
  float rim = smoothstep(0.035, 0.0, abs(d - outer)) * taper;
  return vec2(fill * taper, rim);
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

  // Regular hexagons on the same globe. Latitude goes through the Mercator projection, which keeps
  // shapes true, so they stay hexagons as they curve with the globe (growing towards the poles,
  // like map tiles); an edge's width on screen shrinks with cos(lat).
  float hex = 2.0 * PI / HEXES_AROUND;
  float mercator = log(tan(PI / 4.0 + lat / 2.0));
  float meshLines = 1.0 - smoothstep(px * 0.4, px * 1.3, hexEdge(vec2(lon, mercator) / hex) * hex * cos(lat));

  // Darker in the middle, greener towards the edges
  vec3 col = mix(vec3(0.02, 0.10, 0.015), vec3(0.06, 0.22, 0.04), smoothstep(0.05, 0.65, length(s)));
  col += vec3(0.34, 0.80, 0.22) * globeLines * 0.32;
  col += vec3(0.24, 0.62, 0.15) * meshLines * 0.26;

  // The orb
  float radius = u_radius * (u_intro * u_intro * (3.0 - 2.0 * u_intro));
  vec2 q = (uv - u_orb) / max(radius, 1e-4);
  float d = length(q);
  float ang = atan(q.y, q.x);

  if (d < 1.0) {
    float z = sqrt(1.0 - d * d);
    // A yellow core showing through thick green glass: brightest low on the right, greener up
    // on the left
    float core = smoothstep(1.05, 0.15, length(q - vec2(0.12, -0.14)));
    vec3 sphere = mix(vec3(0.20, 0.55, 0.10), vec3(0.93, 0.92, 0.25), core);
    sphere = mix(sphere, vec3(0.18, 0.55, 0.12), smoothstep(0.3, 0.95, dot(q, normalize(vec2(-0.7, 0.7)))) * 0.4);
    // The glass, thickest at the rim, with a bright edge
    sphere = mix(sphere, vec3(0.35, 0.78, 0.18), smoothstep(0.8, 0.99, d) * 0.6);
    sphere += vec3(0.6, 1.0, 0.4) * smoothstep(0.04, 0.0, abs(d - 0.97)) * 0.4;
    // A darker hollow on the upper left, with a small glint
    float hollow = smoothstep(0.42, 0.18, length(q - vec2(-0.32, 0.4)));
    sphere = mix(sphere, vec3(0.1, 0.45, 0.08), hollow * 0.55);
    sphere += smoothstep(0.035, 0.015, length(q - vec2(-0.26, 0.3))) * 0.8;
    // Gloss, and a slow pulse of light
    vec3 n = vec3(q, z);
    float spec = pow(max(dot(n, normalize(vec3(-0.5, 0.6, 0.8))), 0.0), 30.0);
    sphere += spec * 0.2 + 0.05 * sin(t * 1.6);
    col = mix(col, sphere, smoothstep(1.0, 0.97, d));
  }

  // Curled glass shells wrapped round it, swaying slowly: a crescent under it, a crumpled frond
  // round its right side, and a big faint arc over the top left
  float sway = sin(t * 0.25);
  vec2 bottom = shell(d, ang, -1.85 + 0.1 * sway, 2.7, 0.86, 0.32, 0.0, t);
  vec2 frond = shell(d, ang, 0.1 - 0.12 * sway, 2.4, 0.88, 0.34, 0.06, t * 0.7);
  vec2 arc = shell(d, ang, 2.25 + 0.08 * sway, 2.1, 1.1, 0.3, 0.0, t);
  col = mix(col, vec3(0.62, 0.95, 0.36), (bottom.x * 0.55 + frond.x * 0.5 + arc.x * 0.22) * u_intro);
  col += vec3(0.8, 1.0, 0.55) * (bottom.y * 0.8 + frond.y * 0.9 + arc.y * 0.45) * u_intro;
  // Crinkles of light across the frond
  col += vec3(0.5, 0.9, 0.3) * frond.x * pow(0.5 + 0.5 * sin(ang * 30.0 + d * 12.0 + t), 6.0) * 0.35 * u_intro;
  // A faint halo ring, and streaks trailing off to the left
  col += vec3(0.3, 0.7, 0.15) * smoothstep(0.04, 0.0, abs(d - 1.6)) * 0.18 * u_intro;
  float streaks = smoothstep(-0.95, -1.05, q.x) * smoothstep(-2.6, -1.4, q.x) * smoothstep(0.35, 0.0, abs(q.y + 0.1));
  col += vec3(0.4, 0.85, 0.2) * streaks * pow(0.5 + 0.5 * sin(q.y * 55.0), 8.0) * 0.25 * u_intro;

  // Its glow
  col += vec3(0.6, 0.9, 0.2) * 0.22 / (max(d - 1.0, 0.0) * 5.0 + 0.6) * step(0.98, d) * u_intro;

  // Fade in from black
  col *= smoothstep(0.0, 0.4, u_intro);
  gl_FragColor = vec4(col, 1.0);
}
`;
