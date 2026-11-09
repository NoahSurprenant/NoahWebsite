// /api/visitors: unique visitors per hour over the last two days, for the terminal theme's status
// line. Counted by Cloudflare in front of the site, so the page sets no cookies and nothing here
// sees an IP. Needs CLOUDFLARE_ANALYTICS_TOKEN (Zone > Analytics > Read) and CLOUDFLARE_ZONE_ID
// in the Netlify site's environment; without them it answers 503 and the status line leaves the
// graph out.
const HOURS = 48;

const QUERY = `query ($zone: String!, $since: Time!, $until: Time!) {
  viewer { zones(filter: { zoneTag: $zone }) {
    httpRequests1hGroups(limit: ${HOURS + 1}, filter: { datetime_geq: $since, datetime_lt: $until }, orderBy: [datetime_ASC]) {
      dimensions { datetime }
      uniq { uniques }
    }
  } }
}`;

interface Group {
  dimensions: { datetime: string };
  uniq: { uniques: number };
}

export default async () => {
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) return Response.json({ error: 'not configured' }, { status: 503 });

  const hour = 3600_000;
  const until = Math.floor(Date.now() / hour) * hour;
  const since = until - HOURS * hour;
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      variables: { zone, since: new Date(since).toISOString(), until: new Date(until).toISOString() },
    }),
  });
  const body = await response.json().catch(() => null);
  const groups: Group[] | undefined = body?.data?.viewer?.zones?.[0]?.httpRequests1hGroups;
  if (!response.ok || !groups) return Response.json({ error: 'analytics unavailable' }, { status: 502 });

  // Hours with no traffic are missing from the answer; fill them with zeros
  const byHour = new Map(groups.map(g => [Date.parse(g.dimensions.datetime), g.uniq.uniques]));
  const hours = Array.from({ length: HOURS }, (_, i) => byHour.get(since + i * hour) ?? 0);
  return Response.json({ hours }, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=600, stale-while-revalidate=600',
    },
  });
};

export const config = { path: '/api/visitors' };
