# Osiris: product, data, reliability, and visualization audit

**Audited:** 2026-09-28 UTC (September 27 in Vancouver). **Baseline:** `3f0333dd31a5a85f265528576bca809ba7855755`. **Deployment:** https://osiris-production-7acb.up.railway.app. **Fork:** https://github.com/mathiswrong/osiris.

## Recommendation

Build our own **global intelligence terminal**, with the dense, dark map/news/media aesthetic the user identified in World Monitor. Keep the map prominent and coordinate it with a ranked developments queue and an evidence workspace. Use original provider integrations through our own backend. World Monitor is a design and source-discovery reference, not the product base or a runtime data service. This revised direction supersedes the earlier spacious situation-desk mockup. See [Revised product and source direction](PRODUCT-DIRECTION.md).

Osiris has reusable components and working sources, but it is **not yet trustworthy as a global intelligence dashboard**. Several defects change the meaning of the information, rather than merely its appearance. Fix the data contract and security boundaries before expanding feeds or adding AI interpretation.

The scope here is a product-wide audit, source tracing, live endpoint sampling, browser inspection, and focused offline reproductions. It is not a certification of every camera, article, external lookup, or security boundary. Findings below distinguish live observations, code-confirmed defects, missing configuration, and unverified functionality. Production source code and configuration were not changed during this audit.

## 1. What it does, and what it should do

### Current implementation

- A Next.js/React application whose main page coordinates independent API calls into a shared, loosely typed data object. MapLibre draws a globe/map with overlays and small floating panels.
- Layers include satellite positions, aviation, maritime reference points and optional AIS vessels, cameras, news-channel locations, earthquakes, disasters, fires, infrastructure, cables, and cyber indicators.
- Separate panels add news/alerts, markets, satellite video, location search, routing, entity graphs, and OSINT lookups. A Bluetooth/local network toolbox is also present.
- An Express `intel` service resolves entities with Wikidata, OpenSanctions, RIPE, and related services. The deployed service successfully loaded 20,346 sanctions entities during the baseline deployment check.
- Most data is fetched on demand with process-local caches. There is no unified persistent incident history, evidence model, or globally consistent source-health system.
- It overlays heterogeneous records. It does not establish that nearby news, vessels, cameras, and satellites describe the same event.

### Intended product for your use

1. **Discover:** What significant developments are emerging anywhere in the world?
2. **Prioritize:** What changed since my last visit, and why is it being surfaced?
3. **Understand:** What happened, what is reported, what is corroborated, and what is uncertain?
4. **Investigate:** Bring together news, video, transport, infrastructure, imagery, and historical context for that development.
5. **Return:** Keep a timeline, corrections, and meaningful updates without requiring you to preselect a country.

Ukraine, Iran, and Hormuz should be discoverable situation pages, alongside unexpected developments elsewhere. A region with sparse coverage must appear as a coverage gap, not automatically as quiet.

## 2. Verified source readiness

Snapshots were taken around **04:03–04:08 UTC**. Counts are sample responses, not guarantees of coverage or correctness. `200 OK` alone is not a passing data test.

| Feature | Actual source / behavior | Observation | Assessment |
|---|---|---|---|
| Satellites | CelesTrak TLE groups; SatNOGS fallback; satellite.js SGP4/SDP4 | 18,783 propagated records; source `memory-cache`. ISS orbit endpoint returned 200 and a 92.98-minute period | Working calculation, misleading freshness and incomplete modern catalog support; see F2 |
| Maritime | Hardcoded ports/chokepoints; AISStream requires `AIS_API_KEY` | 52 ports, 10 chokepoints, **0 ships** | Reference geography works; live vessel feed unconfigured |
| CCTV catalog | Many transport agencies plus curated/third-party camera catalogs | 39,505 rows, 55 region entries; two regions pending; 49 duplicate IDs | Catalog works partially; total is not a count of verified live cameras |
| CCTV frames | Eight provider samples requested | Six JPEG signatures confirmed; Hong Kong and Singapore samples returned 403 from this audit client | Partial sample only; request context can affect 403, and JPEG success does not prove fresh imagery |
| Camera source collection | Railway logs | Alberta 400, Ontario 400, Montreal 403; `us-central` and `turkey` remained pending in sampled catalog | Provider-specific failures need visible status |
| Live TV/news channels | Static list of YouTube/Rumble channel URLs | 15 channels; 7 marked embeddable, 8 external-only | A directory, not playback verification or event-associated video |
| News | Nine Telegram channels and nine RSS sources | 114 stories; all 18 sources had items in this snapshot | Useful starting point; source labels/publication times retained; editorial mix and claim verification need work |
| Earthquakes | Browser directly reads USGS M2.5+ last-day feed | Live UI displayed USGS event names/magnitudes; the server route is not the page's actual fetch path | Useful authoritative observations, with threshold/coverage labels needed |
| Global incidents (`/api/gdelt`) | **GDACS disaster RSS**, not GDELT conflict reporting | 248 records | Data returned; broad label obscures that this is a disaster feed |
| GDELT Events | Actual GDELT 2.0 15-minute export | 435 events from window `20260928040000`, 461 scanned | Working ingest; machine-coded reporting is not verified incident truth; client loads once |
| Weather | NASA EONET + NOAA/NWS + GDACS | 46 records: 8 EONET, 2 NWS, 36 GDACS | All three represented in sample; overlapping disasters and stale-cache semantics need correction |
| Fires | NASA FIRMS CSV plus EONET volcanoes | 2,027 combined rows | Working provider response, but sampled fire records and invented volcano measurements; see F6 |
| Conflict zones | Three RSS feeds matched to 15 hardcoded regions | 13 “live events”; a football result mapped as a conflict | **Fails incident semantics**; see F1 |
| Frontlines | DeepState history endpoint | 200; approximately 627 KB | Upstream payload reachable; geometry correctness, source date, and rendered alignment not fully validated |
| Flights | OpenSky + adsb.fi military/regional fallback | Retry returned 61 displayed military aircraft; 0 commercial/private/jets. Raw `total=110`, military upstream=110, regional=0, OpenSky=0 | Severely partial coverage; authenticated OpenSky not configured; count mismatch is raw vs normalized |
| Subsea cables | Bundled GeoJSON attributed to Submarine Cable Map | 717 features | Static reference layer, not current cable operational status |
| SDK overlays | Current SEA drawing uses bundled cable geometries | SEA/AIR/NAVAL defaults enabled; map effect creates only cable links | The names suggest broader integration than the rendered behavior |
| SDK stream/ingest | In-memory entity store, optional keyed ingestion | SSE says `connected:true`, `feedCount:9`, `entityCount:0`, `latticeStatus:disconnected` | Endpoint transport works; no live integration demonstrated |
| Space weather | NOAA SWPC | Kp0, timestamp 03:57 UTC; one flare item | Data returned; client refreshes only on initial load |
| Nuclear infrastructure | Static route dataset | 64 records | Reference locations; no operational monitoring implied |
| Markets | Yahoo Finance quotes + maritime-derived alerts | 28 quotes | Quotes return; market timestamps/closed-market state must be distinct from fetch time |
| Botnet C2 | abuse.ch Feodo Tracker | 5 indicators, 1 online | Feed works; IP location represents infrastructure, not an attack origin or a live attack |
| Malware | abuse.ch URLhaus + IP geolocation | Retry returned 675 online threats | Snapshot works; long-term SSE lifecycle and geolocation coverage not soak-tested |
| Cloudflare Radar | Requires Cloudflare Radar token | 503, explicitly `configured:false` | Correctly reports unconfigured and capabilities gate UI |
| Internet outages | IODA country events | 13 records | Source reachable; code jitters country centroids, falsely implying point precision |
| Sentinel imagery search | Element84 STAC, Sentinel-2 and Copernicus fallbacks | Hormuz-area query returned 10 scenes; first Sentinel-1D scene dated Sep 27 | Catalog search works; first thumbnail is an `s3://` URI, not a browser-ready image. No pixel/change-analysis validation |
| Air quality | Retired OpenAQ v2 | 200 with **0 stations** | Broken integration masked as an empty success; official v2 retirement confirmed |
| Supply-chain supplier risk | 14 fixed facilities; USGS + local fire/GDACS calls | 14 suppliers, all normal at sample | Incorrect fire field and disaster-as-conflict interpretation; current normal status is not reassurance |
| Country risk | Editorial constants for 20 countries + sum of quake magnitudes | 20 countries returned | API explicitly labels editorial basis (good); not a calibrated global risk model |
| Balloons/radiation | Client fetch paths still present, no route implementations | Both 404 | Dormant unfinished functionality, not currently visible default layers |
| AI analysis/briefing | Gemini/environment credentials; some deterministic overview logic | No Gemini keys configured in baseline | Generated analysis unavailable/unvalidated; do not interpret UI presence as working AI |
| Entity investigation | Private Express intel service | Baseline Canada expansion: 58 nodes; sanctions index populated | Working smoke test, not validation of every entity match |
| 3D terrain/buildings/night mode | Map render controls and zoom-dependent layers | Code has explicit terrain availability/zoom feedback | Presentation/reference context; no new intelligence source |

The original cold client probes for flights, malware and the indefinitely streaming SDK route reset. Bounded follow-up checks succeeded. The SDK requires an SSE-aware read; its initial reset is **not** classified as a failed finite JSON endpoint. No deployment crash was established from those resets.

Evidence: [live sample summaries](live-evidence.json), [initial requests](summary.json), [additional requests](extra-summary.json), [camera samples](camera-samples.json), [all 71 API routes](route-inventory.md). The first orbit probe accidentally used `norad` rather than the documented `id` parameter and correctly returned 400; the corrected `?id=25544` returned 200. This is not an application bug.

## 3. Prioritized findings

### F1 — High: incident locations and classifications are fabricated

**Live and code confirmed.** `/api/conflicts` matches article prose against fixed region keywords, adds a deterministic coordinate offset to a regional anchor, assigns `type: conflict`, and replaces event time with the current fetch time.

Live example: **“Ireland beats Israel 3-0 wearing black armbands to support Gaza”** was returned at approximately **31.15, 34.15** as a conflict. An article's mention of Gaza does not establish a violent event there. The fixed region list also excludes Iran and Hormuz as standalone zones, limiting discovery precisely where you want it.

**Repair:** store article and claim separately from incident; use verified/approximate/unknown location precision; show regional mentions as regional context; retain original publication time; classify event semantics; deduplicate evidence; keep unlocated reports in the timeline. Never jitter an uncertain event into a false point location.

Code: [conflict endpoint](../../src/app/api/conflicts/route.ts), especially `KNOWN_CONFLICTS`, keyword matching, offsets, and `timestamp` assignment. IODA repeats the centroid-jitter pattern in [radar](../../src/app/api/radar/route.ts).

### F2 — High: satellite view is a stale snapshot with misleading categories and catalog gaps

**Code confirmed; live catalog and orbit response confirmed.** The page fetches satellite positions once, marks the layer fetched before success, and never polls it. Clicking later requests an orbit anchored to that old snapshot. The calculations can be internally consistent while representing the past.

The API exposes fetch time but no per-object orbital-element epoch/age. Cached entries are backfilled indefinitely in a running process, then stamped with a new cache time. Emergency fallback contains an ISS TLE from day 146 of **2024**. Mission labels are substring heuristics, e.g. `USA` => Military Recon and `COSMOS` => Russian Military; commercial imaging is categorized as communications. These are not verified mission classifications.

There is also a current compatibility problem: every CelesTrak request uses TLE, with IDs sliced from five columns. CelesTrak says five-digit IDs were exhausted July 11, 2026 and newly cataloged six-digit objects are unavailable in TLE. Therefore “All Satellites” cannot mean the complete current catalog. [Official CelesTrak notice](https://celestrak.org/).

**Repair:** modern GP JSON/OMM ingestion; element epoch/source/quality per object; propagate positions locally with a clearly labeled clock; refresh elements on the provider's cadence; remove stale emergency data; classify through maintained metadata; provide search by name/NORAD, category list, orbit detail and a “Locate selected satellite” action. CelesTrak currently requests two-hour GP/SupGP download spacing; the app's one-hour refresh and overlapping group fan-out need redesign. [Usage policy](https://celestrak.org/usage-policy.php).

Code: [page](../../src/app/page.tsx), [catalog](../../src/app/api/satellites/route.ts), [orbit](../../src/app/api/satellites/orbit/route.ts), [map filtering](../../src/components/OsirisMap.tsx). Real satellite.js propagation should be retained.

### F3 — High: camera proxy permits active content and unsafe redirects

**Code confirmed; content-type behavior reproduced offline.** The proxy accepts a broad Amazon S3 hostname family, passes through HTML and SVG types, follows redirects without repeating the allowlist check, disables TLS certificate verification, and lacks an explicit response-size/redirect-depth limit. This creates same-origin active-content and server-side request risks if an allowed origin or redirect can be controlled.

Global `nosniff` exists, but it does not neutralize a response deliberately served as `text/html`. No exploit was sent to production and no private address was probed.

**Repair:** provider-specific HTTPS origins and paths, public-address validation at every hop, verified TLS, limited redirects/bytes/time, and actual raster decoding with a safe MIME allowlist. Reject SVG/HTML. Apply rate limits. Existing helper tests actually assert HTML passthrough, so passing tests do not establish security.

Code: [proxy](../../src/app/api/cctv/proxy/route.ts), [existing test](../../src/app/api/cctv/proxy/route.test.ts). Reproduction: [offline script](reproduce.cjs).

### F4 — High: empty, stale, failed, and healthy feeds are conflated

**Code confirmed and offline reproduced.** A successful fetch from any source sets the global status to connected. A non-2xx response returns false without assigning an error state. Many layers mark themselves loaded before completion, preventing retries after failure. Satellites/fires/global incidents/GDELT do not receive regular client refreshes.

The shared cache keeps previous nonempty records even after a **successful empty** refresh. For warnings, this can retain expired events. It also converts initial provider failures to empty arrays. Routes often then stamp `timestamp: now`, so old records look newly fetched. Partial weather-provider failure is not exposed.

**Repair:** shared source envelope with `status`, `observedAt`, `publishedAt`, `fetchedAt`, `lastSuccessAt`, `expiresAt`, `coverage`, `error`, `isPartial`, and `cacheState`; treat valid empty responses as empty; apply bounded stale grace periods; per-source retries/circuit breakers. Show “data unavailable” separately from “no events.” Process health should remain separate; `/api/health` already honestly labels its limited scope.

Code: [source cache](../../src/lib/sourceCache.ts), [page orchestration](../../src/app/page.tsx), [weather](../../src/app/api/weather/route.ts).

### F5 — High: supplier risk can miss fires and mislabel disasters as armed conflict

**Code confirmed.** The supplier endpoint reads `fireData.data`; fires are returned under `fires`. Its “conflicts” call points to `/api/gdelt`, which actually returns GDACS disasters. Any nearby matching disaster is labeled `ARMED CONFLICT / RIOT`. Both internal calls hardcode localhost port 3000. A failure can leave the default `NORMAL` value without marking incomplete evidence.

**Repair:** call shared typed collectors, use the right event kinds, expose unknown/partial coverage, and show proximity as proximity rather than a measured operational impact. Add contract tests for fire and disaster payloads.

Code: [supplier risk](../../src/app/api/scm-suppliers/route.ts).

### F6 — Medium/high: fire sampling and invented volcano measurements distort meaning

**Code confirmed.** FIRMS rows are selected by CSV stride to approximately 2,000 points. There is no spatial/severity guarantee and no response field disclosing the source count or sampling fraction. Volcanoes are added with hardcoded `brightness:500`, `frp:100`, `confidence:high`. Those numbers are not measurements from EONET.

**Repair:** separate thermal detections from volcano reports; preserve observed values/units/time; publish completeness; retain all records server-side and use spatial aggregation for rendering. Never use invented measurements to make an event fit another schema.

Code: [fires](../../src/app/api/fires/route.ts).

### F7 — Medium: operational counts and labels overstate coverage

**Live and code confirmed.** Maritime counts add static ports/chokepoints to ships. CCTV has 49 repeated IDs (including all 26 unique Rijkswaterstaat cameras duplicated). Enabled SDK AIR/NAVAL flags have no corresponding link generation in the current map effect. The SDK SEA count uses `sdk_entities`, whereas the drawn lines are cables. The SDK stream hardcodes nine feeds even with zero entities.

**Repair:** separate assets, observations and integrations; use source-scoped stable IDs; show “39,456 unique catalog entries; playback not fully checked,” not a live-camera count. Rename cables directly. Remove ineffective toggles and feed counts until actual integrations exist.

Code: [LayerPanel](../../src/components/LayerPanel.tsx), [map](../../src/components/OsirisMap.tsx), [SDK stream](../../src/app/api/sdk/stream/route.ts).

### F8 — Medium: air-quality adapter targets a retired API

**Live, code and provider documentation confirmed.** OpenAQ v2 was retired January 31, 2025. The adapter ignores HTTP status, finds no results, and returns a fresh-looking empty response. [OpenAQ documentation](https://docs.openaq.org/about/about).

**Repair:** migrate to v3/authentication, implement coverage and errors, and use the actual measurement units. The current “WHO/EPA” labels are not an implemented jurisdiction-specific AQI calculation; remove those labels until the conversion is validated.

Code: [air quality](../../src/app/api/air-quality/route.ts).

### F9 — Medium: local recon reports failed connections as open ports

**Offline reproduced.** Mocking all fetches to reject immediately causes all 15 probed ports to be reported as open. Browser denial, mixed-content rules and connection refusal cannot be distinguished by this timing heuristic.

**Repair:** remove the positive service claims or use an explicit authenticated local agent with a defined capability contract. This toolbox is peripheral to your global-awareness purpose and should move out of the main navigation.

Code: [WorldRemote](../../src/components/WorldRemote.tsx); [reproduction results](offline-results.json).

### F10 — Medium: SDK validation, lifetime and scaling are unfinished

**Code confirmed, not exercised with production writes.** Ingest rejects valid zero latitude/longitude through truthiness checks and does not validate coordinate ranges/types. It mutates the store during validation, so a later exception can leave partial writes despite a failure response. Storage is unbounded process memory; SSE sends only the first 500 entities. No stream `cancel()` handler exists; after a disconnect with no data changes, the entity interval can remain allocated. Multiple web replicas would not share the same store.

**Repair:** validate the complete batch first, bounded durable storage with TTL, explicit paging/deltas, authenticated consumers as appropriate, and cleanup on abort/cancel. Fail-closed ingest when the key is absent is a good existing control.

Code: [ingest](../../src/app/api/sdk/ingest/route.ts), [stream](../../src/app/api/sdk/stream/route.ts).

### F11 — Medium: source interpretation needs stronger editorial rules

News does preserve original publication time, attribution and cross-post carriers. That is useful. However, keyword severity is not independent verification; ten reposts of one claim are not ten sources. State and partisan channels need explicit provenance and attribution; “independent” in a source grouping must not imply independently verified reporting. Country scores are explicitly editorial now, but adding earthquake magnitudes to a geopolitical baseline has no validated common scale.

**Repair:** keep source reliability, claim corroboration, event impact, location precision and urgency as separate fields. Use attributed wording. Preserve contradictory claims and corrections. Show published/observed time rather than treating ingestion as event occurrence. Do not label a heuristic 0–100 number a probability.

Code: [news](../../src/app/api/news/route.ts), [country risk](../../src/lib/country-risk.ts).

## 4. Visualization and usability audit

### Why satellites are hard to find

There are three different concepts named like satellite access: **SAT** switches the basemap to aerial imagery; **SPACE** opens an ISS video feed; **SPACE TRACKING** in the layers rail enables orbital objects. The distinction is not clear from the controls. “All Satellites” also overrides individual category selection, so turning on one category does not isolate it while All remains on.

The live browser session was centered at Seattle-area zoom 8, despite a nominal globe-oriented default. At that scale, a planet-wide satellite catalog is difficult to inspect. The desktop layer panel revealed 18,783 objects but no discoverable catalog/search alongside the toggles. Finding a point on the map becomes the entry requirement for seeing its details.

### Broader problems

- The map occupies the attention budget while importance, recency, and missing coverage remain hidden.
- Small icon rails, faint all-caps labels and 9–11px supporting type burden discovery. The browser's narrow layout reduces discoverability further. This audit is not a formal WCAG contrast certification.
- Large entity counts and “STATUS: LIVE” provide confidence without explaining source health.
- Static facilities, public cameras, disaster observations, orbital predictions, and article mentions are visually adjacent without clearly different evidence semantics.
- Crypto tickers, token/support links, local device controls, route planning, and global incidents compete in the primary interface.
- There is no persistent “what changed since last visit” view, source-aware global prioritization, or incident evidence timeline.

### Recommended information architecture

**Primary:** Situation desk · Explore · News & live TV · Satellites · Sources.

**Global workspace:** a prominent world map, compact ranked developments queue, news/broadcast panels, media, and linked evidence detail. Selecting a development updates all relevant panels. Keep the dense terminal aesthetic, thin borders, restrained semantic colors, and compact typography. Explain why each development is prominent; expose missing coverage.

**Incident workspace:** Overview / Timeline / Evidence / Map / Media / Related effects. For Hormuz, this might combine attributed maritime warnings, observed traffic changes, relevant news/TV, ports/cables and imagery acquisitions. Co-occurrence is labeled correlation, not causation. A country or regional mention never becomes a precise point without evidence.

**Satellites:** searchable name/NORAD catalog, mission metadata, propagation time, orbital-element age, category filters, selected orbit and optional globe. Separate **orbiting objects**, **Earth imagery**, and **ISS live video** by name.

**News & TV:** selectable official feeds with region/language/affiliation, last playback check, external-only states and one active audio channel. An event can reference a channel or specific clip; a broadcaster's headquarters is not an incident location. Add transcripts and timestamped excerpts only where available and permitted. Do not imply that a channel is currently discussing the selected incident without evidence.

**Sources:** every adapter has configuration, health, freshness, quota, coverage, last error, source URL and rights metadata. A reader can see gaps without opening developer tools.

**Alternative:** a regional comparison board with parallel Americas / Europe / Middle East / Africa / Asia-Pacific lanes, each with significant changes and coverage status. Useful for overview on a large display; less effective than the situation desk for detailed investigation. Offer this as an alternate view of the same incident model.

## 5. How to draw attention globally

The key new capability is an **event and change pipeline**, not another pile of markers.

1. Ingest records independently of who has a browser open. Preserve raw evidence identifiers, provider and timestamps.
2. Normalize reports and observations; retain location granularity (site/city/region/country/unknown).
3. Group related reports into incidents with time/location/entity constraints. Preserve individual evidence and syndication lineage.
4. Promote changes using explainable rules: official severe alert; independently corroborated new event; material escalation; transport/communications disruption; unusually large change against a regional baseline.
5. Show **why surfaced** and confidence separately. A high-consequence single-source report can appear with an “unconfirmed” label rather than being hidden or promoted as fact.
6. Cap repeated coverage of one incident; reserve space for emerging/undercovered regions; distinguish a media-volume spike from a measured impact spike.
7. Track updates, retractions and resolution. Let users choose “since last visit / 6h / 24h / 7d,” save a developing situation, and ask for a sourced briefing.
8. Evaluate prioritization on historical cases: missed major events, false positives, time to first useful alert, diversity of covered regions, duplicate inflation, and analyst-rated usefulness. Do not tune only on engagement or number of headlines.

AI can help cluster and summarize retrieved evidence after this foundation exists. It should cite evidence per factual sentence, report uncertainty/conflicts, and abstain when source coverage is insufficient. It should not fabricate locations or infer military intent from public transport tracks.

## 6. Comparable projects and what to borrow

This is a review of public documentation and repository structure, **not a code-quality endorsement or deployment test** of these projects.

| Project | Useful idea | Application here |
|---|---|---|
| [World Monitor](https://github.com/koala73/worldmonitor) | Broad source catalog, topical panels, cross-stream context, visible intelligence gaps, news/media, separate ingestion/caching | Strongest comparison for breadth. Audit selected adapters and health contracts; avoid inheriting an overwhelming default layout |
| [Watchtower](https://github.com/lajosdeme/watchtower) | News-first tabs and compact briefing workflow | Borrow the readable hierarchy and simple entry points. Its keyword threat labels still require validation |
| [ConflictWatch](https://github.com/Hamz04/conflict-dashboard) | Scheduled GDELT/RSS ingestion, stored history, timeline analytics and full-text search | Borrow pipeline separation and historical comparisons. Do not import its escalation probabilities or threat index as validated measurements |

World Monitor documents a much broader mix of conflict, humanitarian, energy, aviation and infrastructure feeds, with explicit source group/freshness tracking. Use its catalog to discover original providers, then validate and integrate those providers independently. [Source catalog](https://www.worldmonitor.app/docs/data-sources).

**Revised recommendation:** build our own product using validated Osiris modules and independently implemented source adapters. World Monitor supplies visual and workflow references and leads to underlying providers. Do not depend on its API, MCP, relays, caches, embedded panels, hosted summaries, or proprietary derived scores. There is no planned migration to a World Monitor fork. Validate each original provider’s access, coverage, freshness, attribution, and permitted use separately.

## 7. Source expansion plan

Add sources by the question they answer, with an acceptance test for each. This is a proposed backlog, not a claim that these integrations are already available here.

| Question | Candidate | Admission requirement |
|---|---|---|
| What major disaster is developing? | USGS, GDACS, NASA FIRMS/EONET (existing) | Preserve official alert level, observation time and full coverage; deduplicate overlapping catalogs |
| What is being reported worldwide? | Regional/language RSS, GDELT, selected newsrooms, reviewed public OSINT | Publication time, provenance, source-family deduplication, attributed claims and language coverage |
| What is happening around Hormuz? | [UKMTO warnings](https://www.ukmto.org/), licensed AIS, port/chokepoint throughput | Advisory identifiers, event time, exact vs approximate location; AIS outages distinct from no traffic |
| Are shipping volumes disrupted? | [IMF PortWatch](https://portwatch.imf.org/) | Published methodology/update cadence, baseline and units, access terms verified |
| What is the humanitarian impact? | [ReliefWeb API](https://apidoc.reliefweb.int/), OCHA datasets | Current access requirements, publication date, geography and responsible agency |
| Are communications disrupted? | IODA + optional Cloudflare Radar | Cross-source comparison, country/ASN scope, no invented coordinates |
| What imagery exists? | Copernicus/Element84 STAC | Acquisition time, footprint, sensor, cloud cover, valid preview assets and actual scene accessibility |
| What is visible live? | Official broadcaster embeds and vetted public cameras | Playback check, location confidence, capture time where known, clear external-only fallback |
| What broader consequences are measurable? | Energy, commodity, airport/airspace and trade sources | Measured changes with timestamps and baselines; no automatic causal claim |

Do not purchase feeds until a small acceptance sample proves coverage for the target questions. “All features” should mean a complete investigation workflow, with expandable source coverage and explicit gaps.

## 8. Architecture and hosting direction

**Keep Railway.** The present Next.js service and private intel service fit it; the required long-lived ingestion workers and AIS/SSE connections also fit the current deployment approach. There is no demonstrated benefit to migrating hosting before fixing data semantics.

Proposed components:

- Next.js UI/API serving normalized read models.
- One scheduled ingestion worker with bounded per-provider concurrency, retry policies and quotas.
- PostgreSQL/PostGIS for incidents, evidence, source status, geometry and historical changes.
- Optional Redis when needed for shared cache, queue coordination and fan-out; avoid adding it merely for appearance.
- Private intel service, with bounded lookups and entity-resolution confidence.
- Durable storage for necessary cached catalogs/assets; source snapshots and metadata with explicit retention.

Start with one web instance until process-local AIS/SDK/cache state is externalized. Do not claim horizontal scaling is safe today. Railway's ephemeral filesystem does not preserve catalogs across a replacement deployment. The web deployment currently came from an exact source archive; its GitHub automatic-deployment connection still needs fixing. The intel service is connected to the fork.

Operational gaps: unify metrics/logging, monitor upstream health independently of `/api/health`, add contract tests and scheduled canaries, validate restart behavior, and make analytics explicitly configurable. Current middleware still attempts two calls to a hardcoded internal Umami host even without configuration, including an IP event; this does not prove any analytics were delivered on Railway.

## 9. Verification and engineering quality

### Passing evidence

- Production build completed successfully at this baseline.
- TypeScript check passed.
- Existing suite: **856 passed, 20 skipped**; **72 files passed, 2 skipped**.
- Baseline standalone smoke: home, health, map style, map worker and CSS served.
- Both Railway services deployed; live health reports `serving` with `scope:process` and explicitly no upstream checks.
- Focused offline checks reproduced proxy content types, stale-on-empty cache behavior, and false port reports. Run `node docs/audit-2026-09-28/reproduce.cjs` from the repository root.

### Gaps

- Lint ran out of memory at the default 4 GB heap; it is **not a passing gate**. Root cause remains undiagnosed.
- Baseline npm audit reported 8 advisories (3 moderate, 4 high, 1 critical), all in development dependencies; production-only audit reported zero. These are package-database results, not a security certification.
- No test workflow was found; the existing GitHub workflow publishes Docker images.
- Large mixed-responsibility files (`page.tsx`, `OsirisMap.tsx`), pervasive `any` and incompatible source schemas make mistakes like F5 easy to introduce.
- Hundreds of `intel/node_modules` files are tracked. Remove vendored dependencies from normal source history in a dedicated cleanup, retaining lockfiles.
- README references absent `.env.template`; `.env.example` contains contradictory key requirements. Documentation counts and feature claims do not consistently match implementation.
- Existing positives include terrain error feedback, Cloudflare capability gating, keyed SDK ingest failing closed, tested SSRF protections in some routes, publication timestamps in news, and real orbital math. Preserve those rather than assuming everything is broken.

### Verification still required before an operational release

- Per-provider camera/video playback and freshness checks; sample tests do not validate all 39,505 rows.
- Credentialed OpenSky/AIS/Cloudflare and AI behavior, quota usage and failure states.
- Formal accessibility checks and representative desktop/mobile browser testing. Pointer automation in this IAB session was inconsistent; keyboard activation exposed desktop space controls. No broad “mobile buttons broken” claim is made from that tool behavior.
- End-to-end incident clustering/geolocation truth sets; satellite epoch accuracy and current-catalog completeness.
- Sanitization, auth/rate limits, proxy boundaries, and streaming resource soak tests across the complete API inventory.
- Persistence, backup/restore, redeployment and load behavior. No production load test, credentialed scan or external device control was performed.

## 10. Recommended delivery sequence

### Phase 1 — Trust and safe operation

Fix F1–F8; isolate the camera proxy; introduce typed provider envelopes, stable IDs, and honest empty/stale/partial states. Expose a Sources screen. Repair deployment automation and CI.

**Exit checks:** no invented incident coordinates/measurements; no fresh timestamp masking stale observations; valid empty warnings clear; missing AIS/OpenSky clearly shown; six-digit satellite support; proxy redirects/private targets/active types rejected by tests.

### Phase 2 — Situation desk

Implement persistent incidents/evidence, global change ranking, regional coverage indicators, timeline and incident detail; keep existing map as an Explore view. Add discoverable Satellites navigation and separate imagery/video labels.

**Exit checks:** in a usability test you can find a significant new development, explain why it is highlighted, inspect original evidence and coverage gaps, and locate a named satellite without guessing icons.

### Phase 3 — Newsroom and cross-domain context

Add broadcaster playback health, media evidence cards, selected new sources, transport/communications/humanitarian context, and comparisons against historical baselines. Ship source adapters only after acceptance tests.

**Exit checks:** a Hormuz scenario has attributable maritime warning, news and transport evidence with timestamps; a Ukraine scenario keeps regional reporting distinct from verified location; an unexpected event outside those regions is surfaced by the global view.

### Phase 4 — Sourced briefings and useful alerts

Add AI summaries, saved situations, change digests and explainable notifications. Evaluate false positives and missed events before treating a generated priority score as dependable.

**Decision:** proceed with the situation desk as the primary design, with regional comparison as an alternate view. The first implementation should pair the new shell with the trust repairs; a cosmetic reskin alone would preserve the most consequential problems.
