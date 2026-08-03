import type { TownStats } from "../domain/types";
import { TOWNS } from "../domain/towns";

interface TownCardsProps {
  stats: TownStats;
}

export function TownCards({ stats }: TownCardsProps) {
  return (
    <div className="town-stats">
      {TOWNS.map((town) => {
        const record = stats[town.name];
        const winRate = record.games
          ? Math.round((record.wins / record.games) * 100)
          : 0;
        return (
          <article className="town-card" key={town.name}>
            <img src={town.image} alt={town.name} />
            <div>
              <div className="town-name">{town.name}</div>
              <div className="town-numbers">
                <span>Played<strong>{record.games}</strong></span>
                <span>Wins<strong>{record.wins}</strong></span>
                <span>Losses<strong>{record.losses}</strong></span>
                <span>Win %<strong>{winRate}%</strong></span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
