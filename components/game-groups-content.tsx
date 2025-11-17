"use client";

import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { getGameGroups, getTables, type GameGroup } from "@/actions/get-games";

const GAMES_PER_GROUP = 84;
const GRID_ROWS = 6;
const GRID_COLS = 14; // 6 * 14 = 84

function getResultColor(result: "player" | "tie" | "banker" | null): string {
  if (result === null) return "bg-white/70";
  if (result === "player") return "bg-blue-500";
  if (result === "tie") return "bg-teal-500"; // tree = verde (teal)
  if (result === "banker") return "bg-rose-500"; // bunker = vermelho (rose)
  return "bg-white/70";
}

interface GameSquareProps {
  result: "player" | "tie" | "banker" | null;
}

function GameSquare({ result }: GameSquareProps) {
  return (
    <span
      className={`aspect-square max-w-8 rounded-lg ${getResultColor(result)}`}
    />
  );
}

function formatDuration(
  firstDate: string | null,
  lastDate: string | null
): string {
  if (!firstDate || !lastDate) return "N/A";

  const first = new Date(firstDate);
  const last = new Date(lastDate);
  const diffMs = last.getTime() - first.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h ${diffMinutes % 60}m`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes % 60}m ${diffSeconds % 60}s`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes}m ${diffSeconds % 60}s`;
  }
  return `${diffSeconds}s`;
}

interface GameGroupDisplayProps {
  group: GameGroup;
}

function GameGroupDisplay({ group }: GameGroupDisplayProps) {
  // Criar array de 84 posições, preenchendo com null os espaços vazios
  const squares: Array<"player" | "tie" | "banker" | null> = Array.from({
    length: GAMES_PER_GROUP,
  }).map((_, index) => {
    return group.games[index]?.result ?? null;
  });

  const duration = formatDuration(
    group.stats.firstGameDate,
    group.stats.lastGameDate
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="p-2 bg-slate-100 border border-slate-200/50 rounded-xl h-64 grid grid-rows-6 grid-flow-col auto-cols-fr items-stretch gap-2">
        {squares.map((result, index) => (
          <GameSquare key={index} result={result} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-sm font-medium border border-rose-200">
          Bunker: {group.stats.bankerCount}
        </span>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
          Player: {group.stats.playerCount}
        </span>
        <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium border border-teal-200">
          Tie: {group.stats.tieCount}
        </span>
        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium border border-slate-200">
          Duração: {duration}
        </span>
      </div>
    </div>
  );
}

export default function GameGroupsContent() {
  const [gameGroups, setGameGroups] = useState<GameGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupLimit, setGroupLimit] = useQueryState("limit", {
    defaultValue: "2",
    parse: (value) => value || "2",
    serialize: (value) => value,
  });
  const [selectedTable, setSelectedTable] = useQueryState("table", {
    defaultValue: "",
    parse: (value) => value || "",
    serialize: (value) => value,
  });
  const [tables, setTables] = useState<string[]>([]);

  useEffect(() => {
    async function fetchTables() {
      try {
        const tablesList = await getTables();
        setTables(tablesList);
        // Selecionar a primeira mesa automaticamente se ainda não houver uma selecionada na URL
        if (tablesList.length > 0 && !selectedTable) {
          setSelectedTable(tablesList[0]);
        }
      } catch (error) {
        console.error("Erro ao buscar mesas:", error);
      }
    }

    fetchTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function fetchGames() {
      // Só buscar jogos se houver uma mesa selecionada
      if (!selectedTable) return;

      setLoading(true);
      try {
        const limit = Number(groupLimit) || 2;
        const groups = await getGameGroups(limit, selectedTable);
        setGameGroups(groups);
      } catch (error) {
        console.error("Erro ao buscar jogos:", error);
      } finally {
        setLoading(false);
      }
    }

    // Buscar quando os filtros mudarem ou quando a página carregar
    fetchGames();
  }, [groupLimit, selectedTable]);

  if (loading) {
    return (
      <div className="w-full p-4">
        <div className="mx-auto max-w-7xl">
          <p>Carregando jogos...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="w-full p-6">
        {/* container */}
        <div className="mx-auto flex max-w-7xl justify-between">
          <select
            className="cursor-pointer rounded-xl border border-slate-200/50 bg-slate-100 px-6 py-2"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
          >
            {tables.map((table) => (
              <option key={table} value={table}>
                Mesa {table}
              </option>
            ))}
          </select>
          <select
            className="cursor-pointer rounded-xl border border-slate-200/50 bg-slate-100 px-6 py-2"
            value={groupLimit}
            onChange={(e) => setGroupLimit(e.target.value)}
          >
            <option value="2">02</option>
            <option value="4">04</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="40">40</option>
            <option value="50">50</option>
          </select>
        </div>
      </header>

      <main className="w-full p-4">
        {/* container */}
        <div className="mx-auto grid grid-cols-2 max-w-7xl gap-y-12 gap-x-6">
          {gameGroups.map((group) => (
            <GameGroupDisplay key={group.group} group={group} />
          ))}
        </div>
      </main>
    </>
  );
}

