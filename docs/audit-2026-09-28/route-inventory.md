# API route inventory

Static inventory of all routes at the audited commit. Literal URLs are discovery hints (including documentation strings), not proof of live use. Imported provider modules require tracing. Readiness and verified semantics are in AUDIT.md.

| Route | Methods | Direct environment keys | Literal provider hosts |
|---|---|---|---|
| `/api/ai/analyze` | POST | — | Imported, dynamic, or no upstream |
| `/api/ai/briefing` | POST | — | Imported, dynamic, or no upstream |
| `/api/ai/overview` | POST | — | Imported, dynamic, or no upstream |
| `/api/air-quality` | GET | — | api.openaq.org |
| `/api/aircraft` | GET | — | adsb.lol, api.adsbdb.com |
| `/api/arcgis` | GET | — | 127.0.0.1, www.arcgis.com |
| `/api/cctv/proxy` | GET | — | Imported, dynamic, or no upstream |
| `/api/cctv/resolve` | GET | — | github.com |
| `/api/cctv` | GET | — | 511.alberta.ca, 511on.ca, api.data.gov.sg, api.tfl.gov.uk, caltrans-gis.dot.ca.gov, ckan0.cf.opendata.inter.prod-toronto.ca, data.wsdot.wa.gov, drivebc.ca, gsccam.butlersheriff.org, s3-eu-west-1.amazonaws.com, towercam.butlersheriff.org, traffic.ottawa.ca, ville.montreal.qc.ca, ws.mapserver.transports.gouv.qc.ca, www.earthcam.com, www.quebec511.info, www.travelmidwest.com, www.youtube.com |
| `/api/cctv/stream-status` | GET | — | evil.com, github.com |
| `/api/cctv/texas/snapshot` | GET | — | Imported, dynamic, or no upstream |
| `/api/chain/daily` | GET | — | Imported, dynamic, or no upstream |
| `/api/cloudflare-radar` | GET | CLOUDFLARE_API_TOKEN | api.cloudflare.com, radar.cloudflare.com |
| `/api/conflicts` | GET | — | africa.liveuamap.com, china.liveuamap.com, drc.liveuamap.com, feeds.bbci.co.uk, iraq.liveuamap.com, israelpalestine.liveuamap.com, lebanon.liveuamap.com, liveuamap.com, myanmar.liveuamap.com, rss.nytimes.com, sudan.liveuamap.com, syria.liveuamap.com, www.aljazeera.com, yemen.liveuamap.com |
| `/api/country-risk` | GET | — | earthquake.usgs.gov |
| `/api/crypto` | GET | — | api.coingecko.com |
| `/api/cyber-attacks` | GET | — | feodotracker.abuse.ch |
| `/api/cyber-threats` | GET | — | dashboard.shadowserver.org, www.cisa.gov |
| `/api/directions` | GET | — | router.project-osrm.org, valhalla1.openstreetmap.de |
| `/api/earthquakes` | GET | — | earthquake.usgs.gov |
| `/api/entity/expand` | GET | INTEL_URL, NODE_ENV | localhost, osiris-intel |
| `/api/fires` | GET | — | eonet.gsfc.nasa.gov, firms.modaps.eosdis.nasa.gov |
| `/api/flight-route` | GET | — | api.adsbdb.com, api.airplanes.live, hexdb.io |
| `/api/flights` | GET | OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET | auth.opensky-network.org, opendata.adsb.fi, opensky-network.org |
| `/api/frontlines` | GET | — | deepstatemap.live |
| `/api/gdelt` | GET | — | www.gdacs.org |
| `/api/gdelt-events` | GET | — | www.gdeltproject.org |
| `/api/geo/reverse` | GET | — | Imported, dynamic, or no upstream |
| `/api/geo` | GET | NODE_ENV | freeipapi.com, ip-api.com, ipapi.co |
| `/api/geosearch` | GET | — | photon.komoot.io |
| `/api/github-webhook` | POST | GITHUB_WEBHOOK_FORWARD_URL, GITHUB_WEBHOOK_SECRET | Imported, dynamic, or no upstream |
| `/api/health` | GET | — | Imported, dynamic, or no upstream |
| `/api/infrastructure` | GET | — | earthquake.usgs.gov, en.wikipedia.org |
| `/api/live-news` | GET | — | rumble.com, www.youtube.com |
| `/api/malware` | GET | — | Imported, dynamic, or no upstream |
| `/api/malware/stream` | GET | — | Imported, dynamic, or no upstream |
| `/api/maritime` | GET | AIS_API_KEY | Imported, dynamic, or no upstream |
| `/api/markets/history` | GET | — | query1.finance.yahoo.com |
| `/api/markets` | GET | — | query1.finance.yahoo.com |
| `/api/news` | GET | — | feeds.bbci.co.uk, t.me, tass.com, www.aa.com.tr, www.africanews.com, www.aljazeera.com, www.channelnewsasia.com, www.scmp.com, www.theguardian.com, www.timesofisrael.com |
| `/api/osint/bgp` | GET | — | ip-api.com, stat.ripe.net |
| `/api/osint/certs` | GET | — | crt.sh |
| `/api/osint/crypto` | GET | — | Imported, dynamic, or no upstream |
| `/api/osint/cve` | GET | — | cve.circl.lu, cveawg.mitre.org |
| `/api/osint/dns` | GET | — | dns.google |
| `/api/osint/fingerprint` | GET | — | Imported, dynamic, or no upstream |
| `/api/osint/github` | GET | — | api.github.com |
| `/api/osint/hudsonrock` | GET | — | cavalier.hudsonrock.com |
| `/api/osint/ip` | GET | — | ip-api.com |
| `/api/osint/leaks` | GET | — | api.xposedornot.com |
| `/api/osint/mac` | GET | — | api.maclookup.app |
| `/api/osint/phone` | GET | — | Imported, dynamic, or no upstream |
| `/api/osint/sanctions` | GET | — | Imported, dynamic, or no upstream |
| `/api/osint/shodan` | GET | — | internetdb.shodan.io |
| `/api/osint/sweep` | GET | — | ip-api.com |
| `/api/osint/threats` | GET | — | check.torproject.org, otx.alienvault.com |
| `/api/osint/username` | GET | — | Imported, dynamic, or no upstream |
| `/api/osint/whois` | GET | — | rdap.org |
| `/api/proxy-tiles` | GET | — | Imported, dynamic, or no upstream |
| `/api/radar` | GET | — | api.ioda.inetintel.cc.gatech.edu |
| `/api/region-dossier` | GET | — | commons.wikimedia.org, en.wikipedia.org, photon.komoot.io, www.wikidata.org |
| `/api/satellites/orbit` | GET | — | Imported, dynamic, or no upstream |
| `/api/satellites` | GET | — | celestrak.org, db.satnogs.org |
| `/api/scanner` | GET | SCANNER_KEY, SCANNER_URL | Imported, dynamic, or no upstream |
| `/api/scm-suppliers` | GET | — | 127.0.0.1, earthquake.usgs.gov |
| `/api/sdk/ingest` | POST, GET | SDK_INGEST_KEY | Imported, dynamic, or no upstream |
| `/api/sdk/stream` | GET | — | Imported, dynamic, or no upstream |
| `/api/sentinel` | GET | — | catalogue.dataspace.copernicus.eu, earth-search.aws.element84.com |
| `/api/space-weather` | GET | — | services.swpc.noaa.gov |
| `/api/stats` | GET | — | Imported, dynamic, or no upstream |
| `/api/weather` | GET | — | api.weather.gov, eonet.gsfc.nasa.gov, www.gdacs.org |
