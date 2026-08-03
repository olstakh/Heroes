import type { TownMatchupStats, TownStats } from "../domain/types";
import { TOWNS } from "../domain/towns";

interface TownMatchupTableProps {
  stats: TownMatchupStats;
  totals: TownStats;
}

export function TownMatchupTable({
  stats,
  totals
}: TownMatchupTableProps) {
  return (
    <div className="table-scroll">
      <table className="stats-table town-matchup-table">
        <thead>
          <tr>
            <th scope="col">Town</th>
            {TOWNS.map((town) => (
              <th className="stats-town-heading" scope="col" key={town.name}>
                <img src={town.image} alt="" />
                {town.name}
              </th>
            ))}
            <th scope="col">Overall</th>
          </tr>
        </thead>
        <tbody>
          {TOWNS.map((rowTown) => (
            <tr key={rowTown.name}>
              <th scope="row">
                <span className="town-row-label">
                  <img src={rowTown.image} alt="" />
                  {rowTown.name}
                </span>
              </th>
              {TOWNS.map((columnTown) => {
                const record = stats[rowTown.name][columnTown.name];
                return (
                  <td
                    className={
                      rowTown.name === columnTown.name ? "mirror-matchup" : undefined
                    }
                    key={columnTown.name}
                  >
                    <span className="record-wins">{record.wins}</span>
                    –
                    <span className="record-losses">{record.losses}</span>
                  </td>
                );
              })}
              <td>
                <span className="record-wins">{totals[rowTown.name].wins}</span>
                –
                <span className="record-losses">{totals[rowTown.name].losses}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
