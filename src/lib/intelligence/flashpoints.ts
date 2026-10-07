import { COUNTRY_CENTROIDS, countryName } from "../countryCentroids";
import type { Development, SourceResult } from "./types";
import { healthSignal } from "../health-signals";
const HOUR = 3_600_000;
export interface Journal {
  version: 1;
  records: (Development & { firstSeen: string })[];
  samples: { at: number; healthy: string[] }[];
}
export interface Flashpoint {
  id: string;
  title: string;
  region: string;
  topic: string;
  state:
    "measured alert" | "emerging" | "multi-source watch" | "single-source lead";
  reasons: string[];
  reports: Development[];
  count: number;
  publishers: number;
  firstSeen: string;
  latestAt: string;
  recentCount: number;
  baselineCount: number;
  location?: {
    lat: number;
    lng: number;
    precision: "country context" | "provider observation" | "waterway context" | "activation centroid" | "volcano location";
  };
}
export interface FlashpointResult {
  data: Flashpoint[];
  generatedAt: string;
  baselineReady: boolean;
  baselineHours: number;
  baselineNote: string;
  comparableSources: number;
  healthySources: number;
  excludedSources: string[];
  persistent: boolean;
  unlocatedReports: number;
}
export const WATCH_STATUSES = [
  { id: "emerging", label: "Emerging", color: "#a81824" },
  { id: "early", label: "Early reports", color: "#685647" },
  { id: "multiple", label: "Multi-source", color: "#8e481b" },
  { id: "verified", label: "Verified observations", color: "#08786c" },
] as const;
/** Reporting volume is attention, not an inferred incident severity. */
export function watchAttention(watch: Flashpoint, theme: "day" | "night" = "day") {
  const level = watch.state === "measured alert" ? "alert"
    : watch.state === "emerging" ? "surge"
    : watch.count >= 10 ? "high" : watch.count >= 4 ? "active" : "low";
  const scales = {
    alert: { label: "Measured alert", day: "#a81824", night: "#ff9399" },
    surge: { label: "Reporting surge", day: "#a81824", night: "#ff9399" },
    high: { label: "High volume", day: "#a81824", night: "#ff9399" },
    active: { label: "Active reporting", day: "#a34318", night: "#f7ad81" },
    low: { label: "Low volume", day: "#795421", night: "#dbc09a" },
  };
  return { level, label: scales[level].label, color: scales[level][theme] };
}
export type WatchStatus = (typeof WATCH_STATUSES)[number]["id"];
export type WatchFilter = "all" | WatchStatus;
export function watchTags(watch: Flashpoint): WatchStatus[] {
  const primary: WatchStatus = watch.state === "measured alert" ? "verified"
    : watch.state === "emerging" ? "emerging"
    : watch.state === "multi-source watch" ? "multiple" : "early";
  return [primary];
}
export function matchesWatchFilter(watch: Flashpoint, filter: WatchFilter) {
  return filter === "all" || watchTags(watch).includes(filter);
}
const aliases: Record<string, string[]> = {
  UA: ["Ukraine", "Ukrainian", "Kyiv", "Kiev", "Kharkiv", "Odesa"],
  IR: ["Iran", "Iranian", "Tehran"],
  IL: ["Israel", "Israeli", "Tel Aviv"],
  PS: ["Gaza", "Palestinian", "West Bank"],
  RU: ["Russia", "Russian", "Moscow", "Irkutsk", "Shelekhov", "Siberia", "Siberian"],
  US: ["United States", "U.S.", "American"],
  GB: ["United Kingdom", "Britain", "British"],
  CN: ["China", "Chinese", "Beijing"],
  TW: ["Taiwan", "Taiwanese"],
  KR: ["South Korea"],
  KP: ["North Korea", "Pyongyang"],
  CD: ["DR Congo", "DRC", "Democratic Republic of Congo"],
  CG: ["Republic of Congo"],
  MM: ["Myanmar", "Burmese"],
  TR: ["Turkey", "Turkiye", "Türkiye"],
  SS: ["South Sudan"],
  SD: ["Sudan", "Sudanese"],
  LB: ["Lebanon", "Lebanese", "Beirut"],
  SY: ["Syria", "Syrian", "Damascus"],
  YE: ["Yemen", "Yemeni", "Houthi"],
  SA: ["Saudi Arabia", "Saudi"],
  AE: ["United Arab Emirates", "UAE"],
  IN: ["India", "Indian"],
  PK: ["Pakistan", "Pakistani"],
  AF: ["Afghanistan", "Afghan"],
  HT: ["Haiti", "Haitian"],
  SO: ["Somalia", "Somali"],
  NG: ["Nigeria", "Nigerian"],
  ET: ["Ethiopia", "Ethiopian"],
  VE: ["Venezuela", "Venezuelan"],
};
const extra: Record<string, [number, number]> = {
  KP: [127, 40],
  HT: [-72.7, 19],
  BS: [-77, 24],
  BZ: [-88.7, 17.2],
  BI: [30, -3.5],
  CF: [21, 7],
  TD: [19, 15],
  ER: [39, 15],
  SL: [-11.8, 8.5],
  LR: [-9.4, 6.4],
  LS: [28, -29.5],
  MW: [34, -13],
  NA: [17, -22],
  BW: [24, -22],
  DJ: [43, 11.5],
  TL: [126, -8.8],
  VU: [167, -16],
};
const regions = Object.entries({ ...COUNTRY_CENTROIDS, ...extra })
  .filter(([code]) => code.length === 2)
  .map(([code, [lng, lat]]) => ({
    code,
    name: countryName(code),
    lng,
    lat,
    terms: aliases[code] || [countryName(code)],
  }));
function escaped(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const matchers = regions.map((r) => ({
  ...r,
  pattern: new RegExp(
    `(?<![\\p{L}])(?:${r.terms.map(escaped).join("|")})(?![\\p{L}])`,
    "iu",
  ),
}));
const topics = [
  {
    name: "Conflict & security",
    pattern:
      /\b(?:missiles?|airstrikes?|air strikes?|drone attacks?|ceasefire|invasion|military offensive|bombing|clashes|war|troops|hostages?|attacks?|rebels?|shelling|truce|terrorist|terrorism|ISIS|nuclear weapons?)\b/i,
  },
  {
    name: "Civil unrest & politics",
    pattern:
      /\b(?:protests?|protesters?|coup|martial law|state of emergency|election violence|political crisis|mass arrests|crackdown)\b/i,
  },
  {
    name: "Disaster & health",
    pattern:
      /\b(?:earthquakes?|floods?|wildfires?|hurricanes?|typhoons?|cyclones?|tsunami|eruption|famine|evacuat\w*|landslides?)\b/i,
  },
  {
    name: "Trade & infrastructure",
    pattern:
      /\b(?:sanctions?|shipping|blockade|port closure|power outage|blackout|pipeline|undersea cable|cyberattack|ransomware|oil supply|gas supply)\b/i,
  },
];
export function reportGroups(item: Development) {
  if (item.kind !== "report") return [];
  const health = healthSignal(item.title, item.excerpt);
  const text = health ? `${item.title}\n${item.excerpt || ""}` : item.title;
  if (
    !health && /\b(?:football|soccer|cricket|champions league|world cup|tennis|olympic|movie|film review|opinion|podcast)\b/i.test(
      text,
    )
  )
    return [];
  // Local crime and metaphorical "trade war / truce" are not armed-conflict signals.
  if (
    !health && /\b(?:man|woman|teen|teenager) (?:is )?(?:accused|charged|jailed|arrested)\b/i.test(
      text,
    ) &&
    !/\b(?:terror|militia|military|missile|bomb)\w*/i.test(text)
  )
    return [];
  const classificationText = text.replace(
    /\btrade (?:war|truce)\b/gi,
    "trade negotiations",
  );
  const topic = health ? { name: "Public health" } : topics.find((t) =>
    t.pattern.test(
      classificationText.replace(
        /\b(?:Cold War(?:-era)?|World War [I12]+)\b/gi,
        "historical reference",
      ),
    ),
  );
  if (!topic) return [];
  // Named places in the headline/health lead provide country context only.
  const hits = matchers
    .filter((r) => r.pattern.test(text))
    .filter(
      (r) =>
        !(r.code === "SD" && /South Sudan/i.test(text)) &&
        !(r.code === "CG" && /Democratic Republic|DR Congo/i.test(text)),
    );
  for (const [code, pattern] of [
    ["US", /\bUS\b/],
    ["GB", /\bUK\b/],
  ] as const) {
    const region = matchers.find((r) => r.code === code)!;
    if (pattern.test(text) && !hits.some((r) => r.code === code))
      hits.push(region);
  }
  if (/\b(?:Hormuz|Red Sea|Suez Canal)\b/i.test(text)) {
    const hormuz = /Hormuz/i.test(text),
      suez = /Suez/i.test(text);
    hits.push({
      code: hormuz ? "hormuz" : suez ? "suez" : "red-sea",
      name: hormuz ? "Strait of Hormuz" : suez ? "Suez Canal" : "Red Sea",
      lng: hormuz ? 56.5 : suez ? 32.4 : 38,
      lat: hormuz ? 26.6 : suez ? 30.5 : 20,
      terms: [],
      pattern: /./,
    });
  }
  return (
    hits.length
      ? hits
      : [{ code: "unlocated", name: "Location unresolved", lat: 0, lng: 0 }]
  ).map((r) => ({
    // Unlocated stories cannot be merged into a fictitious worldwide incident.
    key: `${r.code}:${topic.name}${r.code === "unlocated" ? ":" + item.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") : ""}`,
    region: r.name,
    topic: topic.name,
    location:
      r.code === "unlocated"
        ? undefined
        : {
            lat: r.lat,
            lng: r.lng,
            precision: (r.code.length === 2
              ? "country context"
              : "waterway context") as "country context" | "waterway context",
          },
  }));
}
export function advanceJournal(
  before: Journal | undefined,
  results: SourceResult[],
  now: number,
): Journal {
  const records = new Map(
    (before?.records || [])
      .filter((r) => Date.parse(r.occurredAt) > now - 7 * 24 * HOUR)
      .map((r) => [r.id, r]),
  );
  const healthy = results.filter((r) => r.health.state === "healthy");
  for (const result of healthy)
    for (const row of result.data) {
      if (
        Date.parse(row.occurredAt) > now ||
        Date.parse(row.occurredAt) < now - 7 * 24 * HOUR
      )
        continue;
      records.set(row.id, {
        ...row,
        firstSeen:
          records.get(row.id)?.firstSeen || new Date(now).toISOString(),
      });
    }
  const samples = (before?.samples || []).filter(
    (s) => s.at >= now - 7 * 24 * HOUR,
  );
  if (!samples.length || now - samples[samples.length - 1].at >= 60_000)
    samples.push({ at: now, healthy: healthy.map((r) => r.health.id) });
  return {
    version: 1,
    records: [...records.values()]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 20_000),
    samples,
  };
}
function tokens(s: string) {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          ![
            "the",
            "and",
            "for",
            "with",
            "from",
            "after",
            "says",
            "that",
            "this",
            "into",
          ].includes(w),
      ),
  );
}
/** Near-identical headlines count once, including syndicated copies across publishers. */
export function uniqueReports<T extends Development>(rows: T[]): T[] {
  const kept: { row: T; words: Set<string> }[] = [];
  const urls = new Set<string>();
  for (const row of rows) {
    const u = new URL(row.url);
    u.search = "";
    u.hash = "";
    const words = tokens(row.title);
    if (
      urls.has(u.href) ||
      kept.some((k) => {
        const same = [...words].filter((w) => k.words.has(w)).length;
        return (
          words.size > 0 && same / (words.size + k.words.size - same) >= 0.75
        );
      })
    )
      continue;
    kept.push({ row, words });
    urls.add(u.href);
  }
  return kept.map((k) => k.row);
}
export function detectFlashpoints(
  journal: Journal,
  results: SourceResult[],
  now: number,
  persistent = true,
): FlashpointResult {
  const healthy = results
    .filter((r) => r.health.state === "healthy")
    .map((r) => r.health.id);
  const samples = journal.samples
    .filter((s) => s.at >= now - 24 * HOUR)
    .sort((a, b) => a.at - b.at);
  const comparable = healthy.filter(
    (id) =>
      !["usgs", "eonet", "gdacs"].includes(id) &&
      samples.every((s) => s.healthy.includes(id)),
  );
  const baselineHours = samples.length
    ? Math.min(24, (now - samples[0].at) / HOUR)
    : 0;
  const gaps =
    samples.some((s, i) => i > 0 && s.at - samples[i - 1].at > 15 * 60_000) ||
    !samples.length ||
    now - samples[samples.length - 1].at > 15 * 60_000;
  const baselineReady =
    baselineHours >= 23.75 && !gaps && comparable.length >= 3;
  const records = journal.records.filter(
    (r) =>
      healthy.includes(r.sourceId) &&
      Date.parse(r.occurredAt) <= now &&
      Date.parse(r.occurredAt) > now - 24 * HOUR,
  );
  const grouped = new Map<
    string,
    { meta: ReturnType<typeof reportGroups>[number]; rows: typeof records }
  >();
  // A continuing watch keeps its age even after its oldest report leaves the 24h display window.
  const watchFirstSeen = new Map<string, string>();
  for (const row of journal.records) for (const group of reportGroups(row)) {
    const previous = watchFirstSeen.get(group.key);
    if (!previous || row.firstSeen < previous) watchFirstSeen.set(group.key, row.firstSeen);
  }
  for (const row of records)
    for (const group of reportGroups(row)) {
      const bucket = grouped.get(group.key) || { meta: group, rows: [] };
      bucket.rows.push(row);
      grouped.set(group.key, bucket);
    }
  const data: Flashpoint[] = [];
  for (const [id, { meta, rows }] of grouped) {
    const unique = uniqueReports(
      rows.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
    );
    const recent = unique.filter(
      (r) => Date.parse(r.occurredAt) > now - 6 * HOUR,
    );
    if (!unique.length) continue;
    const publishers = new Set(unique.map((r) => r.sourceId)).size;
    const recentPublishers = new Set(
      recent
        .filter((r) => comparable.includes(r.sourceId))
        .map((r) => r.sourceId),
    ).size;
    const compRecent = recent.filter((r) =>
      comparable.includes(r.sourceId),
    ).length;
    const baseline = unique.filter(
      (r) =>
        comparable.includes(r.sourceId) &&
        Date.parse(r.occurredAt) <= now - 6 * HOUR,
    ).length;
    const surge =
      baselineReady &&
      compRecent >= 4 &&
      recentPublishers >= 3 &&
      compRecent >= Math.max(4, (baseline / 3) * 2);
    const state = surge
      ? "emerging"
      : publishers >= 2
        ? "multi-source watch"
        : "single-source lead";
    data.push({
      id: `flash:${id}`,
      title: unique[0].title,
      region: meta.region,
      topic: meta.topic,
      state,
      location: meta.location,
      count: unique.length,
      publishers,
      firstSeen: watchFirstSeen.get(id) || unique.reduce(
        (a, r) => (r.firstSeen < a ? r.firstSeen : a),
        unique[0].firstSeen,
      ),
      latestAt: unique[0].occurredAt,
      recentCount: recent.length,
      baselineCount: baseline,
      reports: unique.slice(0, 30),
      reasons: [
        `${unique.length} distinct headlines from ${publishers} publisher${publishers === 1 ? "" : "s"} in 24 hours; ${recent.length} published in the last 6 hours.`,
        surge
          ? `${compRecent} recent reports vs ${baseline} over the preceding 18 hours across ${comparable.length} continuously available sources.`
          : baselineReady
            ? "No qualifying surge over the comparable 18-hour baseline."
            : "Learning the baseline: 24 hours of continuous observations needed for surge detection.",
        "Grouped by headline topic, health reporting leads and named region; these reports may describe different events. Multiple publishers do not establish independent confirmation.",
      ],
    });
  }
  for (const r of records.filter(
    (r) => r.kind === "earthquake" && r.priority === 2,
  ))
    data.push({
      id: `flash:${r.id}`,
      title: r.title,
      region: "Measured earthquake",
      topic: "Disaster & health",
      state: "measured alert",
      reasons: [r.reason, r.summary],
      reports: [r],
      count: 1,
      publishers: 1,
      firstSeen: r.firstSeen,
      latestAt: r.occurredAt,
      recentCount: 1,
      baselineCount: 0,
      location: r.location,
    });
  const weight = {
    "measured alert": 4,
    emerging: 3,
    "multi-source watch": 2,
    "single-source lead": 1,
  };
  data.sort(
    (a, b) =>
      weight[b.state] - weight[a.state] ||
      b.publishers - a.publishers ||
      b.recentCount - a.recentCount ||
      Date.parse(b.latestAt) - Date.parse(a.latestAt),
  );
  return {
    data,
    generatedAt: new Date(now).toISOString(),
    baselineReady,
    baselineHours,
    baselineNote: baselineReady
      ? "Continuous baseline available"
      : gaps
        ? "Collection gap detected; 24 continuous hours required"
        : comparable.length < 3
          ? "At least 3 continuously healthy reporting feeds required"
          : "Learning: 24 continuous hours required",
    comparableSources: comparable.length,
    healthySources: healthy.length,
    excludedSources: results
      .filter((r) => r.health.state !== "healthy")
      .map((r) => r.health.name),
    persistent,
    unlocatedReports: records.filter(
      (r) => r.kind === "report" && reportGroups(r).some((g) => !g.location),
    ).length,
  };
}
