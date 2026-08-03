export const TOWN_NAMES = [
  "Bulwark",
  "Castle",
  "Conflux",
  "Cove",
  "Dungeon",
  "Factory",
  "Fortress",
  "Inferno",
  "Necropolis",
  "Rampart",
  "Stronghold",
  "Tower"
] as const;

export type TownName = (typeof TOWN_NAMES)[number];

export interface Town {
  name: TownName;
  image: string;
}

export const TOWNS: readonly Town[] = TOWN_NAMES.map((name) => ({
  name,
  image: `${import.meta.env.BASE_URL}Towns/Town_portrait_${name}_small.png`
}));
