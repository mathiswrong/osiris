# Knuckle Tat · Osiris Fork

The home route is our dashboard. `/explore` retains the original Osiris explorer. The public-facing brand is Knuckle Tat, with Osiris Fork retained as attribution. Original licence and attribution files remain intact. New integrations contact original publishers, operators and agencies directly; none call World Monitor services.

## Run

```sh
npm ci
npm run dev -- --port 3217
```

Open http://localhost:3217. Use `localhost` for this development preview; Next development-origin restrictions can block hydration on another hostname. `npm run build` builds the production application.

For collection without an open browser:

```sh
INTELLIGENCE_URL=http://localhost:3217 node tools/collect-intelligence.mjs
# Single health / collection pass:
node tools/collect-intelligence.mjs --once
```

The collector polls the monitor once a minute. Upstream cache intervals still apply. In the Docker image, `tools/start-production.mjs` starts both Next and the collector; either process stopping unexpectedly fails the container so Railway can restart both. SIGTERM stops both processes. The development collector command above remains useful for the local preview.

## Workspace

- A light, high-contrast Day theme is the default. The Day/Night switch persists locally and applies to maps and hover cards. Category colors distinguish observations, satellites, aircraft, vessels and provider military flags.
- The home overview puts six flashpoint watches beside four official live broadcasters, then the global map, an orbital globe with mission dossier, developments and source health on one scrollable page. Narrow phones show three watches until expanded. The full satellite catalogue and source table remain available as drill-downs.
- Mouse hover and keyboard focus previews on records and flashpoints; map marker hover cards; click/tap opens details. Escape dismisses previews.
- Satellite search by name, ID, operator or purpose. Filters cover communications, navigation, Earth observation, research and undocumented objects.
- Mission dossiers for ISS, Starlink, SES-17, Sentinel-1, GPS, Galileo, Landsat 9, OneWeb, Iridium and PlanetScope. Every dossier cites primary documentation. Matching uses curated catalogue IDs or narrow known family patterns, with regression fixtures from the current CelesTrak catalogue.
- Spacecraft, constellation and mission-family claims are explicitly distinguished. United's Starlink relationship applies to the network, not a specific satellite. SES-17 customer disclosures are dated, not a current ranked customer roster. Unknown operators/payloads/clients remain unknown.
- Orbital predictions remain separate from imagery. The map offers a dated NASA GIBS MODIS Terra daily mosaic; the selected product date is shown in UTC, while exact pixel acquisition times vary by location and dark gaps have no imagery. Copernicus and USGS imagery catalogues are linked where relevant. CelesTrak GP JSON supports full catalogue IDs, element epoch/age, SGP4 positions and a selected ground track. Failed propagation is disclosed as partial coverage.
- Source health shows retrieval failures, provider cadence, last successful retrieval and coverage. Failure preserves the original freshness timestamp; successful empty collections replace current snapshots.
- All matching records can be browsed in additional batches of 100; searches operate on the full retrieved set.

## Direct providers

| Provider | Scope | Minimum refresh |
| --- | --- | --- |
| USGS | M2.5+ earthquakes, past day | 1 minute |
| NASA EONET | Open natural events, past seven days | 15 minutes |
| BBC World, Guardian, Al Jazeera, Africanews | Publisher RSS | 5 minutes |
| DW, France 24, CNA, Anadolu, UN News | Publisher / institutional RSS | 5 minutes |
| ABC Australia, NPR World, Sky News World | Direct publisher RSS (mixed topics for ABC) | 5 minutes |
| US Defense Department | Official statements, not independent confirmation | 5 minutes |
| GDACS | Disaster alerts, provider coordinates and event windows | 5 minutes |
| CelesTrak | Active GP orbital catalogue | 2 hours |
| adsb.fi | Regional public ADS-B / MLAT positions, 250 NM radius | 1 minute |
| AIS Stream | Regional vessel messages; API key required | 1 minute |

News adapters retain attributed titles and original links, distinguish publication time from event time, and reject invalid dates, unsafe links, future-dated entries beyond clock tolerance and entries older than seven days. English-language reporting is a coverage limitation. A publisher responding successfully does not verify its claims.

### Video

DW: discover its HLS URL from the official DW live page. Al Jazeera: discover its current Brightcove player from the official live page, read the public browser playback policy, and resolve the public unencrypted HLS source from that player. This is the broadcaster's public player API; no user credentials are involved. Host changes fail closed for review. Streams play directly in the browser, without a restreaming proxy.

France 24 and Sky: discover the current live video ID from the official YouTube channel page. Validate channel identity, embed permission and current-live status; archived and upcoming streams are rejected. The IFrame API reports playback, pause, buffering and errors. Discovery is cached for five minutes. A resolved video URL is not counted as confirmed playback. Each of the four independent home tiles attempts muted autoplay on page load, shows its own playback state, and offers the original broadcaster on failure.

Local verification on 2026-09-28: DW and Al Jazeera emitted actual playing events. France 24 and Sky IDs resolved, but embedded YouTube playback could not be confirmed in the in-app browser. France 24's official page uses the same resolved ID. A standalone YouTube embed reported Error 153 (missing client/referrer identification); this is evidence of an environment constraint, not proof of the exact cause of the blank embedded frame. These two channels need playback verification on the final HTTPS deployment and normal browsers. Do not report all four players as verified.

## Flashpoint detection — transparent first implementation

`/api/intelligence/monitor` reads each original adapter and maintains a seven-day observation journal, bounded to 20,000 records. A report's first-seen time is preserved across refreshes. It is **first seen by this instance**, never a claim to be first worldwide.

- Candidate news watches require headline signals for conflict/security, unrest, disaster/health, or trade/infrastructure. Sports/opinion exclusions reduce obvious false positives. These are inspectable heuristics, not an inferred verified incident feed.
- Grouping is by a named country/waterway and topic. The same cross-border report can appear in multiple regional watches; counts must not be summed globally. A group may contain different events.
- Map rings represent country/waterway context, not precise event coordinates. Unresolved regions stay unlocated. Ordinary articles never acquire invented event coordinates.
- Near-identical titles and canonical article URLs count once, including syndicated copies. Different publishers still do not establish independent confirmation. Evidence retains up to 30 representative reports per watch, with publication times and original links.
- Watches use the last 24 hours and show a separate six-hour count. Single-source leads remain explicitly labelled. USGS significance >=600 produces a provider-measured alert without inventing human impact.
- “Emerging” requires a full rolling day of collection (up to 15 minutes tolerance), no sampling gap over 15 minutes, at least three continuously healthy reporting feeds, at least four distinct reports in six hours from at least three comparable publishers, and at least twice the preceding 18-hour hourly rate. Previously absent topics can qualify only after the baseline is established.
- Stale/unavailable feeds and future publications are excluded. Coverage changes restrict comparison to continuously available publishers. Cold start and gaps visibly keep surge detection in learning mode.

Limitations: English news and headline rules miss events, miss unnamed locations, and may group unrelated events. No calibrated impact prediction, social-platform firehose, live satellite tasking, eyewitness verification or worldwide-first guarantee is claimed. Closing the dashboard stops client polling; run the collector for continuous coverage.

## Persistence and Railway

Set `INTELLIGENCE_DATA_DIR` to a mounted Railway volume for source snapshots and `flashpoint-history.json`. Files use atomic replacement and one in-flight request per provider/monitor coalesces requests within a process. History write failures appear in the monitor. An ephemeral directory can accept writes but still be lost on deployment; `persistent` means the file write succeeded, not that the infrastructure is durable.

Use a single web replica. The Docker entrypoint supervises a separate collector process that polls the same container over loopback. Set `INTELLIGENCE_COLLECTOR_ENABLED=0` only when another collector handles ingestion. Before adding replicas, move history, caching and ingestion locks to shared storage. Do not rely on independent local files across replicas.

Railway configuration: volume at `/data`, `INTELLIGENCE_DATA_DIR=/data/intelligence`, `RAILWAY_RUN_UID=0`, and a 15-second deployment draining interval. Railway mounts volumes as root ([Railway volume permissions](https://docs.railway.com/volumes#permissions)). The entrypoint creates the intelligence directory and assigns ownership, then drops supplementary groups and switches to UID/GID 1001 before starting the web server and collector. Application processes do not run as root. Production history begins with live collection; development snapshots are excluded from the deployment image.

New endpoints accept only fixed provider IDs, never arbitrary fetch URLs:

- `/api/intelligence/monitor`
- `/api/intelligence/source?id=<registered-source>`
- `/api/intelligence/satellites[?id=<catalogue-ID>]`
- `/api/intelligence/broadcast?id=dw|aljazeera|france24|sky`

Source content is rendered as text; evidence URLs are HTTP(S). Existing legacy endpoints retain previously audited risks and are not made production-ready by the new dashboard.

## Validation

44 focused tests cover cache clearing/failure behavior, provenance, malformed observations, catalogue IDs and propagation, mission identity and customer scope, flood-vs-conflict classification, sports exclusion, country ambiguities, separation of unrelated unlocated reports, deduplication, first-seen preservation, baseline learning, qualifying surges, sampling gaps, source coverage changes, stale/future exclusion, ongoing watches, and live-video ownership/offline/embed validation.

Browser checks include real provider responses (all 16 reporting/alert feeds responding), map rendering and selection, SES-17's corrected catalogue identity (49332; 49292 is OneWeb), mission/customer source details, keyboard-preview dismissal, actual DW/Al Jazeera playback, and a 390px viewport with no horizontal overflow. Counts and availability are point-in-time checks.

## Next work

Expand curated dossiers and regional-language coverage; connect the AIS Stream key and validate its live coverage; add NASA FIRMS fire detections after obtaining a MAP_KEY and ReliefWeb structured reports after obtaining an approved appname; calibrate detection against labelled event histories; add revision/retraction handling and analyst review; finish legacy audit repairs; verify the next permitted CelesTrak refresh and long-term collector retention; prepare the public Knuckle Tat release.


## Orbital traffic and connected investigations (2026-09-28)

The satellite workspace now uses Three.js with depth-tested 3D positions, orbit/zoom controls, optional camera rotation, purpose colors, a Starlink toggle and altitude filters. A separate mission inspector shows orbital telemetry and curated operator/capability/customer information. Selecting a satellite preserves the surrounding fleet. The default display spreads/compresses radial altitude for clarity; a true spherical distance scale is available. Reported altitude always remains the SGP4-derived measurement.

Positions are SGP4 predictions at the response timestamp and 60 seconds later. The renderer interpolates Cartesian display positions only inside that interval and holds at its end until refreshed. This is predicted motion, not telemetry. The selected orbit trail and faint sample-mission trails cover one future orbital period in an Earth-fixed frame. Faint paths are representative missions, not a claim to draw every orbit. Decorative lighting is not a day/night calculation. Natural Earth land geometry is public domain ([source](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson)); CARTO/OSM basemaps retain map attribution.

Selecting a flashpoint opens a combined regional investigation. Reports stay attached while users switch aircraft, vessels, military flags, satellite subpoints and provider observations on the same map. Radius choices are 100, 250 and 463 km (250 NM). The default center is explicitly country/waterway context; users may set a more useful center. Shared-report links navigate between named regions in the same evidence. Traffic is current; reporting covers the last 24 hours. Nearby positions are spatial context, not proof of involvement. Satellite subpoints are not imaging footprints or tasking evidence.

`/api/intelligence/traffic?lat=<latitude>&lng=<longitude>` accepts numeric coordinates only. It uses adsb.fi's current `/api/v3/lat/.../lon/.../dist/250` endpoint, queues requests at no more than one per 1.1 seconds per web process, and cites adsb.fi. The public feed is for personal, non-commercial use ([provider documentation](https://github.com/adsbfi/opendata)). Aircraft age comes from provider snapshot time minus `seen_pos`; missing/invalid positions and positions older than five minutes are excluded. Ground-equipment records (including non-transponder emitters and TWR/GND database entries) are excluded from aircraft counts. Military status uses only the provider database bit, never callsign/model guesses. No operational intent is inferred.

AIS uses server-only `AISSTREAM_API_KEY` (also accepts the legacy `AIS_API_KEY`). Each regional collection subscribes to fixed, validated bounding boxes for up to 12 seconds, splitting boxes across the date line. It validates positions, rejects AIS unavailable-value sentinels, distinguishes received time from provider time, and never refreshes position age from static vessel metadata. No key is configured in the local preview, so live vessels are explicitly unavailable and the adapter has not been verified against an authenticated live stream. Military vessel roles are not inferred from AIS names. Regional snapshots are bounded to 64 in-memory keys and 16 in-flight provider requests, with no per-region disk growth.

GDACS GeoRSS coordinates and provider event windows are parsed separately from publication times. Some observed provider records have future event starts: their details explicitly say onset is not established, and they do not receive an automatic high-priority observed-event classification. Updated headline exclusions avoid individual criminal cases, trade-truce metaphors and historical Cold War references becoming armed-conflict watches.

Verification: production build, TypeScript and focused lint pass; 44 focused tests cover the above data contracts, including date-line distance/boxes, military flags, stale ADS-B observations, AIS sentinels/static data, orbital coordinate scale, GDACS coordinates and future event windows. All 16 reporting/alert feeds responded during local checks, and adsb.fi returned actual regional aircraft. Availability and counts are point-in-time observations. Production hosting is now live on Railway; authenticated AIS remains pending.

Browser verification also covered ten condensed rows, related-region navigation to the Strait of Hormuz, live regional aircraft and provider military flags, constellation filtering (16,614 to 5,483 objects with Starlink hidden at the time of the check), true-distance mode, the mission inspector, persistent Night/Day preference, and 390px layouts without horizontal overflow. No browser errors were reported in those checks.

## Railway deployment — 2026-09-28

Live at https://osiris-production-7acb.up.railway.app/ with one web replica, a supervised background collector and a mounted data volume. All 16 reporting/alert adapters responded during deployment checks, as did regional ADS-B. The AIS key remains unconfigured. Flashpoint history starts from the production collection time and must learn a full day before surge detection becomes eligible.

The first CelesTrak transfer exceeded the original 12-second RSS timeout. A diagnostic retry received HTTP 403 explaining that this IP had already downloaded the active group and must wait for the next two-hour update. The satellite download now allows 60 seconds. We restored the existing direct-provider OMM snapshot fetched at 2026-09-28T15:26:09.684Z, preserving that timestamp and marking retrieval stale with the error visible. This is a dated fallback, not a successful Railway refresh. No alternate proxy or provider-rate-limit bypass is used. A future successful refresh must be verified separately. Production observation history was not imported from development.

Deployment evidence: Railway deployment `6e1e5685-88bb-4d98-ba7d-85fc4a8312c2` reached `SUCCESS`. The preceding release was `baf6565d-c858-4a05-bb84-ba1454f420c9`. Volume `db3a35f6-ed0e-4154-9a10-2c5ffc5c2629` is mounted at `/data`. Production process inspection confirmed the supervisor, Next and collector run as `nextjs`; the history file is owned by UID 1001. Baseline history survived the second deployment (first collection 15:36:36 UTC, baseline over 0.22 hours at the final check).

The deployed satellite API returned 16,610 valid predicted positions, an ISS selection and 181 orbit points; 10 catalogue elements could not be propagated. The live browser rendered the globe and ISS mission inspector, and displayed the source-health warning for the dated fallback. The next permitted cached refresh check is 17:40:51 UTC on 2026-09-28; its success has not yet been verified. DW, France 24 and Sky emitted playing states on HTTPS. Al Jazeera stream discovery succeeded and its video reached readyState 4, but the final browser check showed paused, so continuous playback of all four channels is not claimed.

Runtime verification also covered supervisor graceful shutdown and failure of either child process, production TypeScript compilation, the 10 provider-contract tests after the timeout change, and a successful second Railway production build. The 44 broader focused tests were run before deployment. Local code remains available for continued work; deployment was a direct upload of the working build, not a GitHub merge.
