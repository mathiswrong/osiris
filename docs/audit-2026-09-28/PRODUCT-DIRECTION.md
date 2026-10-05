# Revised product and source direction

Updated 2026-09-28 UTC after direct inspection of the user-supplied World Monitor dashboard and the user's corrections.

## Product decision

Build our own global intelligence dashboard on our infrastructure. World Monitor is a reference for visual design, interaction patterns, and discovering original data providers. The user specifically wants those underlying sources integrated directly. This supersedes the suggestion to evaluate World Monitor as our codebase and the earlier spacious, card-based mockup.

Keep the dense intelligence-terminal aesthetic: dark charcoal surfaces, thin square panel borders, compact monospace controls, a prominent geographic map, restrained status colors, and visible news/media. Improve the relationship between panels. A selected development should synchronize its map region, news, evidence, media, transport context, and timeline. The default discovery feed remains global.

## What direct inspection establishes

The hosted dashboard exposes map layers, selectable workspaces, news/broadcast panels, webcams, briefing panels, source-coverage labels, and orbital surveillance. Satellites and webcams are therefore already present there; they are not unique Osiris features.

Observed quality questions include a cached risk panel showing 17/40 sources, a sanctions alert naming “Unknown,” and a “Breaking & Confirmed” section containing single-publisher items. These are reasons to inspect the methodology and underlying records. They are not a complete audit of World Monitor or proof that the reported stories are false. Broadcast playback was not tested.

Reference: [World Monitor dashboard](https://www.worldmonitor.app/dashboard?zoom=1.00&view=global&timeRange=7d&layers=conflicts%2Cbases%2Chotspots%2Cnuclear%2Csanctions%2Cweather%2CcanadaAlerts%2Coutages%2Cnatural).

## Source ownership boundary

Data path: **original provider → our adapter → our durable history/cache → our evidence model → our dashboard**.

- Our services hold our provider credentials, enforce source-specific rate limits, and record original attribution.
- World Monitor's documentation is a discovery aid, never evidence that a feed is accessible, accurate, or permitted for our use.
- No runtime dependency on World Monitor APIs, MCP, relays, cache endpoints, hosted briefings, or embedded panels.
- Published reports, raw observations, reference infrastructure, orbital predictions, and our derived conclusions remain distinguishable.
- Original broadcaster players may be embedded where permitted; link to the publisher when embedding is unavailable. Do not restream arbitrary broadcasts or claim a selected channel is covering a selected event without evidence.
- Scoring and correlation are our own documented methods. We will not import opaque “credibility,” “instability,” or “confirmed” labels as facts.

## Original-provider candidates

This is an integration shortlist, not an assertion that all feeds are operational or licensed. World Monitor's [source catalog](https://www.worldmonitor.app/docs/data-sources) identifies providers across conflict, transport, orbital, news, economic, infrastructure, and disaster domains. The Osiris audit independently examined several existing integrations. Acceptance remains provider by provider.

| Domain | Original providers to investigate/use | Our acceptance requirement |
|---|---|---|
| Earthquakes | USGS | Preserve event ID, origin time, updated time, magnitude and alert fields; source revisions update the same event |
| Disasters and fires | GDACS, NASA FIRMS, NASA EONET | Distinguish reports from measured detections; no invented intensity; disclose sampling |
| Satellite orbits | CelesTrak GP/OMM data | Support larger catalogue IDs, expose element epoch and prediction time; refresh to provider policy |
| Earth imagery | Copernicus / Sentinel and documented STAC providers | Actual available scene, acquisition time, sensor, footprint, preview and asset permissions |
| Conflict and protests | ACLED, UCDP, GDELT | Verify access terms and publication lag; keep curated events separate from machine-extracted news mentions |
| News | Publisher RSS/APIs and official newsroom feeds | Record original publisher and URL, language, publication/revision time; deduplicate syndication |
| TV and video | Official BBC, DW, France 24, Al Jazeera and other broadcaster channels | Verify permitted embed, playback, geographic restrictions and external fallback individually |
| Maritime | AISStream or another licensed AIS provider; UKMTO; IMF PortWatch | Keep vessel observations, safety advisories and aggregate throughput separate; disclose blind spots and lag |
| Aviation | adsb.lol, OpenSky, FAA and other aviation authorities | Receiver coverage, observed time and provenance; do not imply full airspace visibility |
| Humanitarian | UN OCHA HAPI, ReliefWeb, UNHCR | Reporting period, revision, units, geographic scope, and responsible agency |
| Internet disruption | IODA, Cloudflare Radar | Event geography and coverage; missing feed is not zero disruption |
| Energy and economics | U.S. EIA, FRED, ECB, World Bank, GIE AGSI+ | Series units, frequency, vintage, publication lag and access terms |
| Cyber indicators | abuse.ch and original advisories | Indicator age and disposition; an indicator is not evidence of a current local attack |
| Cameras | Official transport/public camera operators | Source URL, location confidence, image capture time where available, playback health and rights |

### Primary documentation checked in this revision

- [USGS GeoJSON feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php): documents stable IDs, origin/updated timestamps, geometry and feeds refreshed every minute. Our ingestion should preserve those semantics.
- [CelesTrak GP formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php): documents OMM and JSON/CSV alternatives and the current six-digit catalogue limitation of TLE. Use a supported modern format in the satellite repair.
- [IMF PortWatch](https://portwatch.imf.org/): the landing page was reachable but provided no extractable methodology in this research pass. Its endpoint, cadence, rights and sample schema remain to be verified.
- OCHA HAPI's documentation could not be retrieved by this research tool in this pass. Treat its adapter as a candidate with access details pending.

## Source contract

Each adapter needs: original provider and URL; source record ID; event/observation time; source publication/update time; retrieval time; coverage window and geography; geometry precision; units; transformation history; access/attribution requirements; health and last successful retrieval.

Health states: healthy, delayed, stale, partial, unavailable, unconfigured. A successful response with zero records is distinct from a failed request. Last-good data retains its original timestamp. Provider outage never silently becomes a calm region.

Deduplicate reports by underlying origin; attach multiple independent pieces of evidence to the same development without claiming geographic co-occurrence proves causality. Rank attention using explicit reasons such as official alert severity, impact, corroborated change and abnormal measured activity. Show sparse coverage independently from importance.

## Corrected interface proposal

1. **Global:** map plus developments queue, synchronized reporting/media and evidence detail.
2. **Satellites & imagery:** clear task choices for catalogue, orbit/passes, Earth imagery and coverage over a selected region. Keep satellite video separately named.
3. **Source health:** user-readable coverage/freshness and exact gaps; configuration details in operator controls.
4. **Expanded workspaces:** maritime, aviation, infrastructure, humanitarian and economic context use the same selection and provenance system.

The revised interactive preview uses independently authored layout code and published Atlas/Natural Earth geographic geometry. It contains clearly labeled sample topics, no live news claims or fabricated orbital paths. Selecting Ukraine updates the region and linked news/media/evidence labels. Satellite controls demonstrate task discovery. It is a proposal, not a deployed application change.

## Delivery sequence

1. Fix the audited Osiris defects that distort data and compromise safe operation.
2. Implement the original-provider registry, source contract, durable ingestion/history, and source health.
3. Build the compact coordinated terminal UI around one complete global-discovery workflow.
4. Expand provider coverage by acceptance tests and actual investigative value.

Railway remains the existing deployment environment. Production application code and services were not changed in this design revision.
