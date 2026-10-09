import { DOOR_X, SCALE } from './constants';
import type { FieldSummary } from './field';
import type { Crop, Job, Rig, Season } from './types';

export interface MachineItem {
  job: Job;
  rig: Rig;
  name: string;
  verb: string;
  /** The season this job usually belongs to. */
  season: Season;
  /** What the HUD says while it works. */
  label: string;
}

export const CROP_INFO: Record<Crop, { name: string; plant: [Rig, string, string, string]; harvest: [Rig, string, string, string]; ripe: string }> = {
  wheat: { name: 'Wheat', plant: ['drill-hopper', 'Seed drill', 'Sow', 'Drilling seed'], harvest: ['combine', 'Combine harvester', 'Harvest', 'Harvesting'], ripe: 'The wheat is golden and ripe.' },
  carrot: { name: 'Carrots', plant: ['drill-precision', 'Precision planter', 'Sow', 'Planting'], harvest: ['roots', 'Root harvester', 'Lift', 'Lifting carrots'], ripe: 'The carrots are ready to lift.' },
  pumpkin: { name: 'Pumpkins', plant: ['drill-few', 'Row planter', 'Plant', 'Planting'], harvest: ['trailer', 'Tractor + trailer', 'Pick', 'Picking pumpkins'], ripe: 'The pumpkins are big and orange.' },
};

/** The four machines the barn holds for a crop, in carousel order. */
export function machinesFor(crop: Crop): MachineItem[] {
  const c = CROP_INFO[crop];
  return [
    { job: 'cultivate', rig: 'cultivate', name: 'Cultivator', verb: 'Work the soil', season: 'spring', label: 'Cultivating' },
    { job: 'plant', rig: c.plant[0], name: c.plant[1], verb: c.plant[2], season: 'spring', label: c.plant[3] },
    { job: 'water', rig: 'spray', name: 'Boom sprayer', verb: 'Water and feed', season: 'summer', label: 'Watering' },
    { job: 'harvest', rig: c.harvest[0], name: c.harvest[1], verb: c.harvest[2], season: 'autumn', label: c.harvest[3] },
  ];
}

const NEEDS = 0.1;

/**
 * Which job the barn marks "Next up". Winter is rest; otherwise the field decides:
 * ripe crop first (this crop's, or another left standing), then bare ground, then seed, then water. Null when nothing needs doing.
 */
export function nextUp(season: Season, f: FieldSummary): Job | null {
  if (season === 'winter') return null;
  if (f.ripe >= 0.05 || f.otherRipe) return 'harvest';
  if (f.bare >= 0.5) return 'cultivate';
  if (f.cultivated >= NEEDS) return 'plant';
  if (f.dry >= NEEDS) return 'water';
  if (f.bare >= NEEDS) return 'cultivate';
  return null;
}

export function statusLine(season: Season, f: FieldSummary, crop: Crop): string {
  if (season === 'winter') return 'Snow on the field. Nothing needs doing; stay as long as you like.';
  switch (nextUp(season, f)) {
    case 'harvest':
      if (f.ripe < 0.05 && f.otherRipe) {
        const n = CROP_INFO[f.otherRipe].name.toLowerCase();
        return `Ripe ${n} ${f.otherRipe === 'wheat' ? 'is' : 'are'} still standing; pick ${n} in the barn to bring ${f.otherRipe === 'wheat' ? 'it' : 'them'} in.`;
      }
      return CROP_INFO[crop].ripe;
    case 'cultivate': return season === 'spring' ? 'Spring is here. Time to work the soil.' : 'The ground is bare. Work the soil when you like.';
    case 'plant': return 'The soil is worked and ready for seed.';
    case 'water': return 'The seed is in. Give it a drink.';
    default: return 'The crop is growing. Nothing needs doing.';
  }
}

/** Out-of-season machines are shown quieter, but can always be picked. */
export function isQuiet(item: MachineItem, season: Season, next: Job | null): boolean {
  return item.season !== season && item.job !== next;
}

// ---- rig geometry, in drawing units along the heading (front is +x) ----
export const EXT: Record<Rig, [number, number]> = {
  cultivate: [-70, 46], 'drill-hopper': [-66, 46], 'drill-precision': [-66, 46], 'drill-few': [-66, 46],
  spray: [-80, 46], combine: [-50, 62], roots: [-86, 46], trailer: [-96, 46],
};
/** Where a rig parks in the barn, facing the door, fully inside. */
export const parkX = (rig: Rig) => DOOR_X - 8 - EXT[rig][1] * SCALE;
/** The turntable pivot, along the heading from the rig's origin. */
export const rigMid = (rig: Rig) => ((EXT[rig][0] + EXT[rig][1]) / 2) * SCALE;
/** Where the implement meets the ground, along the heading from the rig's origin. */
export const workOffset = (rig: Rig) => (rig === 'combine' ? 50 : rig === 'roots' || rig === 'trailer' ? -60 : -64) * SCALE;
