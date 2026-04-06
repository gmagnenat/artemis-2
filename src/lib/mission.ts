/** Artemis II mission constants and utilities */

export const MISSION = {
  name: "Artemis II",
  callsign: "Integrity",
  launchTime: new Date("2026-04-01T22:35:12Z"),
  splashdownTime: new Date("2026-04-11T00:17:00Z"),
  closestApproach: new Date("2026-04-06T23:01:00Z"),
  maxEarthDistance: 406_775, // km (surface-to-surface)
  closestMoonDistance: 8_282.5, // km (surface-to-surface)
} as const;

export type MissionPhase =
  | "pre-launch"
  | "launch"
  | "earth-orbit"
  | "translunar-injection"
  | "outbound-coast"
  | "lunar-flyby"
  | "return-coast"
  | "reentry"
  | "splashdown"
  | "complete";

interface PhaseWindow {
  phase: MissionPhase;
  label: string;
  /** Seconds after launch this phase starts */
  startMET: number;
  color: string;
}

const h = (hours: number) => hours * 3600;
const d = (days: number) => days * 86400;

/** Mission phases with MET (Mission Elapsed Time) boundaries */
export const PHASE_TIMELINE: PhaseWindow[] = [
  { phase: "launch", label: "Launch", startMET: 0, color: "var(--color-accent-red)" },
  { phase: "earth-orbit", label: "Earth Orbit", startMET: h(0.33), color: "var(--color-accent-blue)" },
  { phase: "translunar-injection", label: "TLI Burn", startMET: d(1) + h(1.23), color: "var(--color-accent-gold)" },
  { phase: "outbound-coast", label: "Outbound Coast", startMET: d(1) + h(1.5), color: "var(--color-accent-blue)" },
  { phase: "lunar-flyby", label: "Lunar Flyby", startMET: d(4) + h(7), color: "var(--color-accent-gold)" },
  { phase: "return-coast", label: "Return Coast", startMET: d(5) + h(18.87), color: "var(--color-accent-cyan)" },
  { phase: "reentry", label: "Reentry", startMET: d(9) + h(1.48), color: "var(--color-accent-red)" },
  { phase: "splashdown", label: "Splashdown", startMET: d(9) + h(1.7), color: "var(--color-accent-cyan)" },
];

export function getMissionElapsedTime(): number {
  const now = Date.now();
  const launch = MISSION.launchTime.getTime();
  return Math.max(0, (now - launch) / 1000);
}

export function getMissionPhase(elapsedSeconds?: number): PhaseWindow {
  const met = elapsedSeconds ?? getMissionElapsedTime();

  if (met <= 0) {
    return { phase: "pre-launch", label: "Pre-Launch", startMET: 0, color: "var(--color-lunar-400)" };
  }

  const splashdownMET = (MISSION.splashdownTime.getTime() - MISSION.launchTime.getTime()) / 1000;
  if (met >= splashdownMET) {
    return { phase: "complete", label: "Mission Complete", startMET: splashdownMET, color: "var(--color-accent-cyan)" };
  }

  // Find the last phase whose startMET is <= current MET
  let current = PHASE_TIMELINE[0];
  for (const p of PHASE_TIMELINE) {
    if (met >= p.startMET) current = p;
    else break;
  }
  return current;
}

export function isArchiveMode(): boolean {
  return Date.now() > MISSION.splashdownTime.getTime();
}

export function formatMET(elapsedSeconds: number): string {
  const days = Math.floor(elapsedSeconds / 86400);
  const hours = Math.floor((elapsedSeconds % 86400) / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = Math.floor(elapsedSeconds % 60);

  return `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatDistance(km: number): string {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(2)}M km`;
  if (km >= 1_000) return `${(km / 1_000).toFixed(1)}K km`;
  return `${km.toFixed(0)} km`;
}
