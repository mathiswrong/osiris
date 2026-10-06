export type SourceState = "healthy" | "partial" | "stale" | "unavailable";
export interface SourceHealth {
  id: string;
  name: string;
  url: string;
  state: SourceState;
  fetchedAt: string | null;
  checkedAt: string;
  nextCheckAt: string;
  count: number;
  error: string | null;
  coverage: string;
  refreshMs: number;
}
export interface Development {
  id: string;
  sourceId: string;
  source: string;
  title: string;
  url: string;
  occurredAt: string;
  timeLabel?: string;
  updatedAt?: string;
  kind: "earthquake" | "hazard" | "report";
  reason: string;
  priority: number;
  summary: string;
  excerpt?: string;
  location?: { lat: number; lng: number; precision: "provider observation" | "activation centroid" | "volcano location" };
}
export interface SourceResult<T = Development> {
  data: T[];
  health: SourceHealth;
}
export interface SatellitePosition {
  id: string;
  name: string;
  epoch: string;
  lat: number;
  lng: number;
  altKm: number;
  predictedAt: string;
  periodMinutes: number;
  elementAgeHours: number;
  inclination?: number;
  eccentricity?: number;
  speedKmS?: number;
  next?: { lat: number; lng: number; altKm: number };
}
export interface SatelliteResult extends SourceResult<SatellitePosition> {
  track?: [number, number][][];
  selectedId?: string;
  orbit?: { lat: number; lng: number; altKm: number; at: string }[];
  contextOrbits?: {
    id: string;
    points: { lat: number; lng: number; altKm: number; at: string }[];
  }[];
}
// Shared by the monitor and Live Alerts so coverage does not depend on the workspace.
export const ADDITIONAL_REPORTING_SOURCES = [
  {
    id: "cbs", name: "CBS World", url: "https://www.cbsnews.com/latest/rss/world",
    refreshMs: 300_000, coverage: "World reporting · publisher RSS, including emerging health incidents",
    lean: "US newsroom", bloc: "western",
  },
  {
    id: "euronews", name: "Euronews", url: "https://www.euronews.com/rss",
    refreshMs: 300_000, coverage: "European and international reporting · publisher RSS",
    lean: "European newsroom", bloc: "western",
  },
  {
    id: "meduza", name: "Meduza English", url: "https://meduza.io/rss/en/all",
    refreshMs: 300_000, coverage: "Independent Russian newsroom · English reporting and analysis",
    lean: "Independent Russian newsroom", bloc: null,
  },
  {
    id: "moscow-times", name: "The Moscow Times", url: "https://www.themoscowtimes.com/rss/news",
    refreshMs: 300_000, coverage: "Independent Russian newsroom · English news, including regional incidents",
    lean: "Independent Russian newsroom", bloc: null,
  },
  {
    id: "ecdc", name: "ECDC Epidemiological Updates", url: "https://www.ecdc.europa.eu/en/taxonomy/term/1310/feed",
    refreshMs: 15 * 60_000, coverage: "Official European disease assessments · publication updates, not real-time case counts",
    lean: "EU public health agency", bloc: null,
  },
  {
    id: "who-don", name: "WHO Disease Outbreak News",
    url: "https://www.who.int/api/hubs/diseaseoutbreaknews?$orderby=PublicationDateAndTime%20desc&$top=50&$select=Id,Title,PublicationDateAndTime,ItemDefaultUrl,Summary",
    refreshMs: 15 * 60_000, coverage: "Official reports of confirmed or potential health events · past 30 days · not exhaustive surveillance",
    lean: "International public health agency", bloc: null,
  },
] as const;
export const SOURCE_DEFINITIONS = [
  {
    id: "usgs",
    name: "USGS",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
    refreshMs: 60_000,
    coverage: "Earthquakes M2.5+ · past 24 hours",
  },
  {
    id: "eonet",
    name: "NASA EONET",
    url: "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7",
    refreshMs: 15 * 60_000,
    coverage: "Open natural events · last 7 days · latest reported point",
  },
  {
    id: "bbc",
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    refreshMs: 5 * 60_000,
    coverage: "English world news · publisher RSS · no inferred locations",
  },
  {
    id: "guardian",
    name: "The Guardian",
    url: "https://www.theguardian.com/world/rss",
    refreshMs: 5 * 60_000,
    coverage: "English world news · publisher RSS · no inferred locations",
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    refreshMs: 5 * 60_000,
    coverage: "English news · publisher RSS · no inferred locations",
  },
  {
    id: "africanews",
    name: "Africanews",
    url: "https://www.africanews.com/feed/rss",
    refreshMs: 5 * 60_000,
    coverage: "African news · publisher RSS · no inferred locations",
  },
  {
    id: "dw",
    name: "DW World",
    url: "https://rss.dw.com/rdf/rss-en-world",
    refreshMs: 300_000,
    coverage: "English world news · German public international broadcaster",
  },
  {
    id: "france24",
    name: "France 24",
    url: "https://www.france24.com/en/rss",
    refreshMs: 300_000,
    coverage: "English international news · French public broadcaster",
  },
  {
    id: "cna",
    name: "CNA",
    url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml",
    refreshMs: 300_000,
    coverage: "Asia-focused English reporting · Singapore broadcaster",
  },
  {
    id: "anadolu",
    name: "Anadolu Agency",
    url: "https://www.aa.com.tr/en/rss/default?cat=world",
    refreshMs: 300_000,
    coverage: "World reporting · Turkish state agency",
  },
  {
    id: "unnews",
    name: "UN News",
    url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
    refreshMs: 300_000,
    coverage:
      "UN institutional reporting · humanitarian and international affairs",
  },
  {
    id: "abc",
    name: "ABC Australia",
    url: "https://www.abc.net.au/news/feed/51120/rss.xml",
    coverage: "Australian public broadcaster \u00b7 international reporting",
    refreshMs: 300000,
  },
  {
    id: "npr",
    name: "NPR World",
    url: "https://feeds.npr.org/1004/rss.xml",
    coverage: "US public media \u00b7 world reporting",
    refreshMs: 300000,
  },
  {
    id: "sky",
    name: "Sky News World",
    url: "https://feeds.skynews.com/feeds/rss/world.xml",
    coverage: "UK broadcaster \u00b7 world reporting",
    refreshMs: 300000,
  },
  {
    id: "defense",
    name: "US Defense Department",
    url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=20",
    coverage:
      "Official US government statements \u00b7 claims by a party, not independent confirmation",
    refreshMs: 300000,
  },
  {
    id: "gdacs",
    name: "GDACS",
    url: "https://www.gdacs.org/xml/rss.xml",
    coverage:
      "Global disaster alerts \u00b7 provider coordinates and alert levels",
    refreshMs: 300000,
  },
  {
    id: "cems",
    name: "Copernicus Rapid Mapping",
    url: "https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/?limit=100",
    coverage: "Emergency mapping activations · past 60 days · activation-area centroid",
    refreshMs: 15 * 60_000,
  },
  {
    id: "hans",
    name: "USGS HANS",
    url: "https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes",
    coverage: "Volcanoes with elevated alert levels · latest notice, not eruption confirmation",
    refreshMs: 15 * 60_000,
  },
  {
    id: "ooni",
    name: "OONI Explorer",
    url: "https://api.ooni.io/api/v1/incidents/search?limit=100",
    coverage: "Published internet interference findings · curated, not live telemetry",
    refreshMs: 6 * 60 * 60_000,
  },
  ...ADDITIONAL_REPORTING_SOURCES,
] as const;
export const SATELLITE_SOURCE = {
  id: "celestrak-active",
  name: "CelesTrak",
  url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON",
  refreshMs: 2 * 60 * 60_000,
  coverage: "Active satellite catalogue · predicted positions from GP elements",
};
export type SourceDefinition = {
  id: string;
  name: string;
  url: string;
  refreshMs: number;
  coverage: string;
};
