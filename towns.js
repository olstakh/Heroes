window.HEROES_TOWNS = Object.freeze([
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
].map((name) => Object.freeze({
  name,
  image: `Towns/Town_portrait_${name}_small.png`
})));
