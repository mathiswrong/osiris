import type { SatellitePosition } from "./types";
export type Purpose =
  | "Communications"
  | "Earth observation"
  | "Navigation"
  | "Research"
  | "Not documented";
interface Evidence {
  label: string;
  url: string;
}
export interface MissionProfile {
  key: string;
  name: string;
  purpose: Purpose;
  operator: string;
  scope: "Spacecraft" | "Constellation" | "Mission family";
  summary: string;
  capabilities: string[];
  users: string;
  customers: {
    name: string;
    relationship: string;
    scope: string;
    announced: string;
    source: Evidence;
  }[];
  limitations: string;
  sources: Evidence[];
  data?: Evidence;
}
const nasa = {
  label: "NASA · International Space Station",
  url: "https://www.nasa.gov/reference/international-space-station/",
};
const ses = {
  label: "SES · operational announcement, 16 June 2022",
  url: "https://www.ses.com/press-release/fully-operational-ses-17-starts-delivering-connectivity-services-across-americas",
};
const sentinel = {
  label: "ESA · Sentinel-1 mission",
  url: "https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-1/Introducing_the_Sentinel-1_mission",
};
export const PROFILE_REVIEWED = "2026-09-28";
export const PROFILES: Record<string, MissionProfile> = {
  oneweb: {
    key: "oneweb",
    name: "Eutelsat OneWeb",
    purpose: "Communications",
    operator: "Eutelsat / OneWeb",
    scope: "Constellation",
    summary:
      "Low Earth orbit broadband for enterprise, government, aviation and maritime connectivity.",
    capabilities: [
      "Low-latency broadband through a constellation operating around 1,200 km altitude.",
      "Connectivity for fixed sites, vessels and aircraft using compatible terminals and ground infrastructure.",
    ],
    users:
      "Enterprise and government customers, connectivity distributors, airlines and maritime operators.",
    customers: [
      {
        name: "Gogo Galileo",
        relationship:
          "Business aviation connectivity solution powered by the OneWeb LEO network.",
        scope:
          "Constellation / service partnership, not a contract with this individual spacecraft",
        announced: "Operator documentation reviewed 2026-09-28",
        source: {
          label: "Eutelsat · business aviation / Gogo Galileo",
          url: "https://www.eutelsat.com/satellite-services/aviation/business-aviation",
        },
      },
    ],
    limitations:
      "Fleet capabilities do not establish which customer is connected to this spacecraft, current throughput or coverage at a specific location.",
    sources: [
      {
        label: "Eutelsat · OneWeb constellation",
        url: "https://www.eutelsat.com/satellite-network/oneweb-leo-constellation",
      },
      {
        label: "Eutelsat · business aviation / Gogo Galileo",
        url: "https://www.eutelsat.com/satellite-services/aviation/business-aviation",
      },
    ],
  },
  iridium: {
    key: "iridium",
    name: "Iridium",
    purpose: "Communications",
    operator: "Iridium",
    scope: "Constellation",
    summary:
      "A cross-linked L-band satellite network for mobile voice, data and connected devices, including polar regions.",
    capabilities: [
      "Satellite voice and data connectivity through compatible terminals.",
      "Supports aviation communications and position reporting; maritime and remote operations use the network.",
    ],
    users:
      "Aviation and maritime operators, remote field teams and connected-device services.",
    customers: [],
    limitations:
      "A constellation profile does not establish an individual satellite’s service status, hosted payloads or current customers.",
    sources: [
      { label: "Iridium · network", url: "https://www.iridium.com/network" },
      {
        label: "Iridium · aviation services",
        url: "https://www.iridium.com/markets/aviation",
      },
    ],
  },
  planet: {
    key: "planet",
    name: "PlanetScope / Dove family",
    purpose: "Earth observation",
    operator: "Planet",
    scope: "Mission family",
    summary:
      "Optical Earth imaging satellites used to monitor changes across land areas.",
    capabilities: [
      "PlanetScope imagery products include 3 m spatial resolution products; the constellation targets near-daily land coverage.",
      "Multispectral imagery supports change monitoring; spectral bands depend on the spacecraft generation.",
    ],
    users:
      "Mapping, environmental monitoring, agriculture, public agencies and commercial analysts.",
    customers: [],
    limitations:
      "Revisit is a fleet capability, not a guarantee for this spacecraft or location. Clouds and illumination limit optical observations. Imagery access may require a Planet subscription.",
    sources: [
      {
        label: "Planet · PlanetScope documentation",
        url: "https://docs.planet.com/data/imagery/planetscope/",
      },
    ],
    data: {
      label: "Planet Explorer · imagery catalogue",
      url: "https://www.planet.com/explorer/",
    },
  },
  iss: {
    key: "iss",
    name: "International Space Station",
    purpose: "Research",
    operator: "International partnership: NASA, Roscosmos, ESA, JAXA and CSA",
    scope: "Spacecraft",
    summary:
      "A crewed orbital laboratory for science, technology demonstrations and studying long-duration human spaceflight.",
    capabilities: [
      "Microgravity experiments in biology, physics and materials science.",
      "Crew-supported experiments and instruments exposed to the space environment.",
    ],
    users:
      "Partner space agencies, research institutions and commercial research teams.",
    customers: [],
    limitations:
      "This catalogue does not establish which experiment is running now or provide access to onboard cameras.",
    sources: [nasa],
    data: {
      label: "NASA · research explorer",
      url: "https://www.nasa.gov/mission/station/research-explorer/",
    },
  },
  starlink: {
    key: "starlink",
    name: "Starlink",
    purpose: "Communications",
    operator: "SpaceX",
    scope: "Constellation",
    summary:
      "A low Earth orbit communications network delivering internet connectivity through a constellation of satellites.",
    capabilities: [
      "Broadband connectivity through ground terminals.",
      "Mobile connectivity offerings include aviation and maritime services; hardware and capabilities vary by satellite generation.",
    ],
    users:
      "Residential, enterprise, transport and government customers use network services.",
    customers: [
      {
        name: "United Airlines",
        relationship:
          "Publicly announced onboard internet deployment. Aircraft hand off between satellites.",
        scope: "Starlink network — not this individual spacecraft",
        announced: "2025-03-07",
        source: {
          label: "United · first aircraft installation",
          url: "https://united.mediaroom.com/2025-03-07-United-Installs-Starlink-on-First-Regional-Aircraft",
        },
      },
    ],
    limitations:
      "No public mapping of individual customer traffic to this satellite. Payload generation, instantaneous capacity and direct-to-cell capability are not established by its catalogue name.",
    sources: [
      {
        label: "SpaceX · Starlink technology",
        url: "https://starlink.com/technology",
      },
    ],
  },
  ses17: {
    key: "ses17",
    name: "SES-17",
    purpose: "Communications",
    operator: "SES",
    scope: "Spacecraft",
    summary:
      "A high-throughput geostationary communications satellite serving the Americas and North Atlantic.",
    capabilities: [
      "Ka-band connectivity with a digital payload and almost 200 user beams.",
      "Services for aviation, maritime, enterprise and government connectivity.",
    ],
    users: "Connectivity providers and their end customers.",
    customers: [
      {
        name: "Thales InFlyt Experience",
        relationship: "Publicly announced aviation connectivity customer.",
        scope: "SES-17 spacecraft",
        announced: "2022-06-16",
        source: ses,
      },
      {
        name: "SSi Canada and COMNET",
        relationship:
          "Named connectivity customers in the operational announcement.",
        scope: "SES-17 spacecraft",
        announced: "2022-06-16",
        source: ses,
      },
    ],
    limitations:
      "These are dated public disclosures, not a complete current customer roster or a ranking by revenue. Current beam allocation is not public here.",
    sources: [ses],
  },
  sentinel1: {
    key: "sentinel1",
    name: "Copernicus Sentinel-1",
    purpose: "Earth observation",
    operator: "ESA / European Union Copernicus programme",
    scope: "Mission family",
    summary:
      "Radar imaging of land and oceans for environmental monitoring and disaster response.",
    capabilities: [
      "C-band synthetic aperture radar provides day/night, all-weather imagery.",
      "Applications include sea ice, ship detection, oil spills and ground motion.",
      "Sentinel-1C and 1D add AIS reception; this capability does not apply to 1A or 1B.",
    ],
    users:
      "Copernicus services, researchers, public agencies and commercial data users.",
    customers: [],
    limitations:
      "Capabilities describe the mission. An overhead position does not prove an acquisition or reveal a sensor footprint. Mission status must be checked separately from catalogue inclusion.",
    sources: [sentinel],
    data: {
      label: "Copernicus Data Space · imagery catalogue",
      url: "https://dataspace.copernicus.eu/",
    },
  },
  gps: {
    key: "gps",
    name: "Global Positioning System",
    purpose: "Navigation",
    operator: "United States government",
    scope: "Constellation",
    summary:
      "Radio signals allow receivers to calculate position, navigation and precise time.",
    capabilities: [
      "One-way timing and orbit signals used by compatible receivers.",
      "Civil and military services; available signals depend on the spacecraft generation.",
    ],
    users:
      "Transport, surveying, communications, scientific and military users.",
    customers: [],
    limitations:
      "GPS does not receive a list of devices using its signals. Individual end users cannot be identified from orbital data.",
    sources: [
      {
        label: "GPS.gov · space segment",
        url: "https://www.gps.gov/space-segment",
      },
    ],
  },
  galileo: {
    key: "galileo",
    name: "Galileo",
    purpose: "Navigation",
    operator: "European Union Galileo programme",
    scope: "Constellation",
    summary:
      "European global satellite navigation and timing services under civilian control.",
    capabilities: [
      "Positioning and timing for compatible receivers.",
      "The system also relays search-and-rescue distress signals; payload availability varies by spacecraft.",
    ],
    users:
      "Public and professional navigation users; search-and-rescue authorities.",
    customers: [],
    limitations:
      "System capabilities do not establish the health of this spacecraft or identify individual receivers.",
    sources: [
      {
        label: "ESA · What is Galileo?",
        url: "https://www.esa.int/Applications/Satellite_navigation/Galileo/What_is_Galileo",
      },
    ],
  },
  landsat9: {
    key: "landsat9",
    name: "Landsat 9",
    purpose: "Earth observation",
    operator: "NASA / USGS",
    scope: "Spacecraft",
    summary:
      "Multispectral and thermal observations track changes in Earth’s land surface.",
    capabilities: [
      "OLI-2: 30 m multispectral sampling and a 15 m panchromatic band.",
      "TIRS-2 measures thermal infrared radiation from the surface.",
    ],
    users:
      "Scientists, public agencies, resource managers and commercial analysts.",
    customers: [],
    limitations:
      "Sampling resolution is not a guarantee of usable imagery. Clouds, acquisition timing and processing affect availability.",
    sources: [
      {
        label: "USGS · Landsat 9",
        url: "https://www.usgs.gov/landsat-missions/landsat-9",
      },
    ],
    data: {
      label: "USGS EarthExplorer · image search",
      url: "https://earthexplorer.usgs.gov/",
    },
  },
};
/** Curated identities only. Broad prefixes such as USA, COSMOS or military guesses are intentionally unsupported. */
export function missionFor(
  s: Pick<SatellitePosition, "id" | "name">,
): MissionProfile | null {
  if (s.id === "25544") return PROFILES.iss;
  if (s.id === "49332") return PROFILES.ses17;
  if (s.id === "49260") return PROFILES.landsat9;
  const n = s.name.trim().toUpperCase();
  if (/^NAVSTAR \d+ \(USA \d+\)$/.test(n)) return PROFILES.gps;
  if (/^GSAT\d{4} \(GALILEO(?:[ -](?:\d+|PFM|FM\d+))\)$/.test(n))
    return PROFILES.galileo;
  if (/^STARLINK-\d+(?: \[DTC\])?$/.test(n)) return PROFILES.starlink;
  if (/^SENTINEL-1[ABCD]$/.test(n)) return PROFILES.sentinel1;
  if (/^GPS (?:BIIR|BIIRM|BIIF|BIII)-\d+(?: \(PRN \d+\))?$/.test(n))
    return PROFILES.gps;
  if (/^GSAT\d{4}(?: \(PRN E\d+\))?$/.test(n)) return PROFILES.galileo;
  if (/^ONEWEB-\d+$/.test(n)) return PROFILES.oneweb;
  if (/^IRIDIUM \d+$/.test(n)) return PROFILES.iridium;
  if (/^FLOCK \d+[A-Z]*-\d+$/.test(n)) return PROFILES.planet;
  return null;
}
