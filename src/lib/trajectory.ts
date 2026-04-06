/**
 * JPL Horizons API data pipeline for Artemis II trajectory.
 *
 * Fetches ephemeris vectors for the spacecraft (NAIF -1024) and the Moon (301),
 * parses them into typed position arrays, and exposes an interpolation helper
 * so consumers can get smooth positions at any timestamp.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single position sample in J2000 ecliptic, Earth-centered (km). */
export interface PositionSample {
  time: Date;
  x: number;
  y: number;
  z: number;
}

/** Pre-computed distances at a given instant. */
export interface DistanceSample {
  earth: number; // km from Earth center
  moon: number; // km from Moon center
}

/** Full trajectory dataset returned by `loadTrajectory()`. */
export interface TrajectoryData {
  spacecraft: PositionSample[];
  moon: PositionSample[];
  /** True when we fell back to baked-in data. */
  isFallback: boolean;
}

// ---------------------------------------------------------------------------
// Horizons API helpers
// ---------------------------------------------------------------------------

// Use Vite proxy in dev to avoid CORS, direct URL in production (via Vercel Edge Function)
const HORIZONS_API =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "/api/horizons"
    : "https://ssd.jpl.nasa.gov/api/horizons.api";

/** NAIF IDs */
const SPACECRAFT_ID = "-1024"; // Artemis II / Orion
const MOON_ID = "301";

interface HorizonsResponse {
  result: string;
  signature?: { version: string; source: string };
}

function buildUrl(naifId: string, startTime: string, stopTime: string, stepSize: string): string {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${naifId}'`,
    EPHEM_TYPE: "VECTORS",
    CENTER: "'500@399'", // Earth geocenter
    START_TIME: `'${startTime}'`,
    STOP_TIME: `'${stopTime}'`,
    STEP_SIZE: `'${stepSize}'`,
    OUT_UNITS: "'KM-S'",
    REF_SYSTEM: "'J2000'",
    VEC_TABLE: "'2'",
  });
  return `${HORIZONS_API}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Extract position vectors from the Horizons text result.
 *
 * Between the $$SOE / $$EOE markers the format is groups of lines:
 * ```
 * 2461136.500000000 = A.D. 2026-Apr-06 00:00:00.0000 TDB
 *  X =-1.209600459835138E+05 Y =-3.486507804423185E+05 Z =-3.221467687921705E+04
 *  VX=-6.092887396420858E-02 VY=-6.481456269074923E-01 VZ=-5.876356121144685E-02
 * ```
 * We only need the date line and the X/Y/Z position line.
 */
export function parseHorizonsResult(text: string): PositionSample[] {
  const soeIdx = text.indexOf("$$SOE");
  const eoeIdx = text.indexOf("$$EOE");
  if (soeIdx === -1 || eoeIdx === -1) {
    throw new Error("Could not find $$SOE/$$EOE markers in Horizons result");
  }

  const block = text.slice(soeIdx + 5, eoeIdx).trim();
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

  const samples: PositionSample[] = [];

  // Month abbreviations used by Horizons
  const MONTHS: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const dateRe = /A\.D\.\s+(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/;
  const posRe = /X\s*=\s*([-+\dEe.]+)\s+Y\s*=\s*([-+\dEe.]+)\s+Z\s*=\s*([-+\dEe.]+)/;

  let currentDate: Date | null = null;

  for (const line of lines) {
    const dm = dateRe.exec(line);
    if (dm) {
      const [, yr, mon, day, hh, mm, ss] = dm;
      currentDate = new Date(
        Date.UTC(
          Number(yr),
          MONTHS[mon] ?? 0,
          Number(day),
          Number(hh),
          Number(mm),
          Number(ss),
        ),
      );
      continue;
    }

    const pm = posRe.exec(line);
    if (pm && currentDate) {
      samples.push({
        time: currentDate,
        x: Number(pm[1]),
        y: Number(pm[2]),
        z: Number(pm[3]),
      });
      currentDate = null;
    }
  }

  return samples;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchBody(naifId: string): Promise<PositionSample[]> {
  const start = "2026-04-02 02:00"; // trajectory starts after ICPS separation (Apr 2 01:58:32 TDB)
  const stop = "2026-04-10 23:00"; // ephemeris ends ~Apr 10 23:54 TDB
  const step = "1 h";

  const url = buildUrl(naifId, start, stop, step);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Horizons API returned ${res.status}`);
  }
  const json: HorizonsResponse = await res.json();
  return parseHorizonsResult(json.result);
}

// ---------------------------------------------------------------------------
// Public fetch
// ---------------------------------------------------------------------------

/**
 * Load trajectory data from JPL Horizons.
 * Falls back to baked-in data on any failure.
 */
export async function loadTrajectory(): Promise<TrajectoryData> {
  try {
    const [spacecraft, moon] = await Promise.all([
      fetchBody(SPACECRAFT_ID),
      fetchBody(MOON_ID),
    ]);
    if (spacecraft.length === 0 || moon.length === 0) {
      throw new Error("Empty dataset returned from Horizons");
    }
    return { spacecraft, moon, isFallback: false };
  } catch (err) {
    console.warn("[trajectory] Horizons fetch failed, using fallback data:", err);
    return {
      spacecraft: FALLBACK_SPACECRAFT,
      moon: FALLBACK_MOON,
      isFallback: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

/**
 * Linearly interpolate position at an arbitrary Date from a sorted sample array.
 * Clamps to first/last sample if `time` is outside the data range.
 */
export function interpolatePosition(samples: PositionSample[], time: Date): PositionSample {
  if (samples.length === 0) {
    return { time, x: 0, y: 0, z: 0 };
  }

  const t = time.getTime();
  const first = samples[0];
  const last = samples[samples.length - 1];

  if (t <= first.time.getTime()) return { ...first, time };
  if (t >= last.time.getTime()) return { ...last, time };

  // Binary search for the bracketing interval
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (samples[mid].time.getTime() <= t) lo = mid;
    else hi = mid;
  }

  const a = samples[lo];
  const b = samples[hi];
  const segLen = b.time.getTime() - a.time.getTime();
  const alpha = segLen > 0 ? (t - a.time.getTime()) / segLen : 0;

  return {
    time,
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    z: a.z + (b.z - a.z) * alpha,
  };
}

/**
 * Compute the distance between two 3-D positions (km).
 */
export function distance3D(a: PositionSample, b: PositionSample): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Magnitude of a position vector (distance from the coordinate origin = Earth center).
 */
export function magnitude(p: PositionSample): number {
  return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
}

const EARTH_RADIUS = 6_371; // km
const MOON_RADIUS = 1_737.4; // km

/**
 * Convenience: get Earth + Moon distances at a given Date.
 * Returns surface-to-surface distances (subtracts body radii).
 */
export function getDistancesAt(
  spacecraft: PositionSample[],
  moon: PositionSample[],
  time: Date,
): DistanceSample {
  const scPos = interpolatePosition(spacecraft, time);
  const moonPos = interpolatePosition(moon, time);
  return {
    earth: magnitude(scPos) - EARTH_RADIUS,
    moon: distance3D(scPos, moonPos) - MOON_RADIUS,
  };
}

// ---------------------------------------------------------------------------
// Static fallback data
// ---------------------------------------------------------------------------
// A handful of representative position vectors spanning the mission.
// Earth-centered J2000 ecliptic, km.
// These are rough estimates derived from published Artemis II trajectory profiles.

function makeDate(iso: string): Date {
  return new Date(iso);
}

const FALLBACK_SPACECRAFT: PositionSample[] = [
  // Launch + LEO
  { time: makeDate("2026-04-01T22:35:00Z"), x: 5_000, y: 3_000, z: 500 },
  // Post-TLI, outbound
  { time: makeDate("2026-04-02T12:00:00Z"), x: -25_000, y: -40_000, z: -5_000 },
  { time: makeDate("2026-04-03T00:00:00Z"), x: -55_000, y: -110_000, z: -12_000 },
  { time: makeDate("2026-04-03T12:00:00Z"), x: -75_000, y: -175_000, z: -18_000 },
  { time: makeDate("2026-04-04T00:00:00Z"), x: -90_000, y: -230_000, z: -22_000 },
  { time: makeDate("2026-04-04T12:00:00Z"), x: -100_000, y: -280_000, z: -26_000 },
  { time: makeDate("2026-04-05T00:00:00Z"), x: -108_000, y: -320_000, z: -29_000 },
  { time: makeDate("2026-04-05T12:00:00Z"), x: -115_000, y: -350_000, z: -31_000 },
  // Close to Moon
  { time: makeDate("2026-04-06T00:00:00Z"), x: -120_960, y: -348_651, z: -32_215 },
  { time: makeDate("2026-04-06T12:00:00Z"), x: -135_000, y: -355_000, z: -35_000 },
  // Lunar flyby (closest approach ~Apr 6 23:01 UTC)
  { time: makeDate("2026-04-06T23:00:00Z"), x: -155_000, y: -365_000, z: -40_000 },
  // Return coast
  { time: makeDate("2026-04-07T12:00:00Z"), x: -148_000, y: -340_000, z: -37_000 },
  { time: makeDate("2026-04-08T00:00:00Z"), x: -130_000, y: -300_000, z: -32_000 },
  { time: makeDate("2026-04-08T12:00:00Z"), x: -108_000, y: -255_000, z: -26_000 },
  { time: makeDate("2026-04-09T00:00:00Z"), x: -85_000, y: -200_000, z: -20_000 },
  { time: makeDate("2026-04-09T12:00:00Z"), x: -60_000, y: -140_000, z: -14_000 },
  { time: makeDate("2026-04-10T00:00:00Z"), x: -35_000, y: -75_000, z: -8_000 },
  { time: makeDate("2026-04-10T12:00:00Z"), x: -12_000, y: -20_000, z: -3_000 },
  // Reentry / splashdown
  { time: makeDate("2026-04-11T00:17:00Z"), x: -4_000, y: -3_500, z: -500 },
];

const FALLBACK_MOON: PositionSample[] = [
  { time: makeDate("2026-04-01T22:35:00Z"), x: -163_000, y: -345_000, z: -37_000 },
  { time: makeDate("2026-04-02T12:00:00Z"), x: -158_000, y: -349_000, z: -37_500 },
  { time: makeDate("2026-04-03T00:00:00Z"), x: -152_000, y: -352_000, z: -38_000 },
  { time: makeDate("2026-04-03T12:00:00Z"), x: -146_000, y: -355_000, z: -38_300 },
  { time: makeDate("2026-04-04T00:00:00Z"), x: -140_000, y: -357_000, z: -38_500 },
  { time: makeDate("2026-04-04T12:00:00Z"), x: -134_000, y: -359_000, z: -38_600 },
  { time: makeDate("2026-04-05T00:00:00Z"), x: -128_000, y: -360_000, z: -38_500 },
  { time: makeDate("2026-04-05T12:00:00Z"), x: -122_000, y: -360_500, z: -38_300 },
  { time: makeDate("2026-04-06T00:00:00Z"), x: -116_000, y: -360_000, z: -38_000 },
  { time: makeDate("2026-04-06T12:00:00Z"), x: -110_000, y: -359_000, z: -37_500 },
  { time: makeDate("2026-04-06T23:00:00Z"), x: -105_000, y: -357_500, z: -37_000 },
  { time: makeDate("2026-04-07T12:00:00Z"), x: -98_000, y: -355_000, z: -36_000 },
  { time: makeDate("2026-04-08T00:00:00Z"), x: -91_000, y: -352_000, z: -35_000 },
  { time: makeDate("2026-04-08T12:00:00Z"), x: -84_000, y: -348_000, z: -33_800 },
  { time: makeDate("2026-04-09T00:00:00Z"), x: -77_000, y: -343_000, z: -32_500 },
  { time: makeDate("2026-04-09T12:00:00Z"), x: -70_000, y: -337_000, z: -31_000 },
  { time: makeDate("2026-04-10T00:00:00Z"), x: -63_000, y: -330_000, z: -29_300 },
  { time: makeDate("2026-04-10T12:00:00Z"), x: -56_000, y: -322_000, z: -27_500 },
  { time: makeDate("2026-04-11T00:17:00Z"), x: -49_000, y: -313_000, z: -25_500 },
];
