export interface TrafficContact {
  id: string;
  name: string;
  kind: "aircraft" | "vessel";
  lat: number;
  lng: number;
  observedAt: string;
  receivedAt: string;
  timestampBasis: "provider position time" | "received by this server";
  source: string;
  sourceUrl: string;
  military: boolean;
  classification: string;
  registration?: string;
  model?: string;
  altitudeFt?: number;
  speedKnots?: number;
  heading?: number;
  destination?: string;
}
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180,
    dLat = (b.lat - a.lat) * rad,
    dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function validPosition(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
const numeric = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) ? n : undefined;
export function aircraftContacts(
  payload: unknown,
  receivedAt: string,
): TrafficContact[] {
  const p = payload as {
    ac?: Record<string, unknown>[];
    now?: number;
    msg?: string;
  };
  if (
    !p ||
    !Array.isArray(p.ac) ||
    typeof p.now !== "number" ||
    !Number.isFinite(p.now)
  )
    throw new Error("Invalid ADS-B response");
  if (
    Date.parse(receivedAt) - p.now > 300_000 ||
    p.now - Date.parse(receivedAt) > 60_000
  )
    throw new Error(
      "Aircraft provider snapshot is more than five minutes out of date",
    );
  return p.ac.flatMap((a) => {
    const seen = numeric(a.seen_pos);
    if (
      a.type === "adsb_icao_nt" ||
      a.t === "TWR" ||
      a.t === "GND" ||
      !validPosition(a.lat, a.lon) ||
      typeof a.hex !== "string" ||
      !/^~?[a-f0-9]{6}$/i.test(a.hex) ||
      seen === undefined ||
      seen < 0 ||
      seen > 300
    )
      return [];
    const observationTime = p.now! - seen * 1000;
    if (Date.parse(receivedAt) - observationTime > 300_000) return [];
    const observedAt = new Date(observationTime).toISOString();
    const military = typeof a.dbFlags === "number" && (a.dbFlags & 1) === 1;
    return [
      {
        id: `air:${a.hex}`,
        name:
          typeof a.flight === "string" && a.flight.trim()
            ? a.flight.trim()
            : String(a.r || a.hex),
        kind: "aircraft" as const,
        lat: a.lat as number,
        lng: a.lon as number,
        observedAt,
        receivedAt,
        timestampBasis: "provider position time" as const,
        source: "adsb.fi",
        sourceUrl: `https://globe.adsb.fi/?icao=${encodeURIComponent(a.hex)}`,
        military,
        classification: military
          ? "Military flag in provider database; mission unknown"
          : "No military flag in provider database; this does not establish civilian status",
        registration: typeof a.r === "string" ? a.r : undefined,
        model:
          typeof a.desc === "string"
            ? a.desc
            : typeof a.t === "string"
              ? a.t
              : undefined,
        altitudeFt: numeric(a.alt_baro),
        speedKnots: numeric(a.gs),
        heading: numeric(a.track),
      },
    ];
  });
}
export function vesselContact(
  payload: unknown,
  receivedAt: string,
): TrafficContact | null {
  const p = payload as {
    MessageType?: string;
    MetaData?: Record<string, unknown>;
    Message?: Record<string, Record<string, unknown>>;
  };
  if (
    !p?.MessageType ||
    ![
      "PositionReport",
      "StandardClassBPositionReport",
      "ExtendedClassBPositionReport",
    ].includes(p.MessageType)
  )
    return null;
  const position = p.Message?.[p.MessageType],
    meta = p.MetaData;
  if (!position || !meta || position.Valid === false) return null;
  const lat = position.Latitude ?? meta.latitude ?? meta.Latitude,
    lng = position.Longitude ?? meta.longitude ?? meta.Longitude;
  const mmsi = String(meta.MMSI || position.UserID || "");
  if (!/^\d{9}$/.test(mmsi) || !validPosition(lat, lng)) return null;
  const rawTime =
    typeof meta.time_utc === "string" ? Date.parse(meta.time_utc) : NaN;
  if (
    Number.isFinite(rawTime) &&
    (Date.parse(receivedAt) - rawTime > 600_000 ||
      rawTime - Date.parse(receivedAt) > 60_000)
  )
    return null;
  const speed = numeric(position.Sog),
    heading = numeric(position.TrueHeading),
    course = numeric(position.Cog);
  return {
    id: `ship:${mmsi}`,
    name: String(meta.ShipName || mmsi).trim(),
    kind: "vessel",
    lat: lat as number,
    lng: lng as number,
    observedAt: Number.isFinite(rawTime)
      ? new Date(rawTime).toISOString()
      : receivedAt,
    receivedAt,
    timestampBasis: Number.isFinite(rawTime)
      ? "provider position time"
      : "received by this server",
    source: "AIS Stream",
    sourceUrl: "https://aisstream.io",
    military: false,
    classification: "AIS position report; vessel role unverified",
    speedKnots: speed !== undefined && speed < 102.3 ? speed : undefined,
    heading:
      heading !== undefined && heading < 360
        ? heading
        : course !== undefined && course < 360
          ? course
          : undefined,
  };
}
/** Split at the date line; AIS corners are latitude/longitude, not GeoJSON order. */
export function regionBoxes(
  lat: number,
  lng: number,
  radiusKm: number,
): number[][][] {
  const dLat = radiusKm / 110.574,
    dLng = Math.min(
      180,
      radiusKm / (111.32 * Math.max(0.01, Math.cos((lat * Math.PI) / 180))),
    );
  const south = Math.max(-90, lat - dLat),
    north = Math.min(90, lat + dLat);
  if (dLng === 180)
    return [
      [
        [south, -180],
        [north, 180],
      ],
    ];
  const west = lng - dLng,
    east = lng + dLng;
  if (west < -180)
    return [
      [
        [south, west + 360],
        [north, 180],
      ],
      [
        [south, -180],
        [north, east],
      ],
    ];
  if (east > 180)
    return [
      [
        [south, west],
        [north, 180],
      ],
      [
        [south, -180],
        [north, east - 360],
      ],
    ];
  return [
    [
      [south, west],
      [north, east],
    ],
  ];
}
