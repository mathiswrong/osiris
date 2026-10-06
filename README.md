# KNUCKLETAT

A global open source intelligence dashboard with attributed reporting, observations, public broadcasts, and specialist source lookups.

## Where to look

- `/` — Global situation, four-channel desktop video wall, flashpoint monitor, map, developments, satellites, and source health.
- `/#signals` — the homepage's Telegram activity analysis, channel coverage, X and Bluesky searches, and specialist dataset lookups.
- `/explore` — Interactive map explorer with aviation, maritime, CCTV, weather, cyber, and other layers.
- `/docs` — Interface and API reference.

The four official broadcast players appear together on desktop. Phones retain a single selectable player. Players start muted and each broadcaster controls whether its stream can play in an embed.

Telegram topics compare posts in the latest six hours with the preceding six hours across the sampled public channel previews. Reposts show circulation, not independent confirmation. X and Bluesky buttons open searches on those platforms; their content is not ingested as dashboard evidence.

Global also reads Copernicus Rapid Mapping activations, USGS HANS elevated volcano alerts, and published OONI findings. Source health shows retrieval times and failures. Mapping centroids, volcano locations, and provider notices are labeled by what they represent.

## Run locally

```sh
npm ci
npm run dev -- --port 3217
```

Open [http://localhost:3217](http://localhost:3217). For a production check, run `npm run build` and `npm test`.

Most feeds work without credentials. The optional HDX HAPI, ReliefWeb, and Global Fishing Watch lookups need server-side provider credentials; `.env.example` lists the required variables. Until configured, the Signals tab shows their setup state.

## Google measurement

Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `GOOGLE_SITE_VERIFICATION` before building. Docker builds accept both as build arguments; Railway supplies configured service variables to those arguments. Analytics is restricted to production builds on `knuckletat.com` and `www.knuckletat.com`.

The KNUCKLETAT web stream uses `G-3KKNWF2TF6` in the Dialect account owned by `paul@dialect.nyc`. Its key events are `view_region` (a loaded regional desk), `follow_region` (a successfully stored follow), `save_investigation` (a successfully stored investigation), and `share` (a successfully copied map link). The last three measure committed actions. Enhanced measurement is disabled: page views are sent once per route change with queries, fragments and unknown paths excluded. Regional paths use `/regions/[region]`; the regional events supply the public region identifier. Notes, search inputs, evidence text and copied URLs are excluded. Advertising personalization and Google signals are disabled in the tag.

Search Console uses the `https://knuckletat.com/` URL-prefix property and the verification meta tag in the root layout. Keep the token configured after verification and submit `https://knuckletat.com/sitemap.xml`.

## License

MIT. The original copyright notice and license terms are preserved in [LICENSE](LICENSE).
