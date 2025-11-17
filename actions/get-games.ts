"use server";

import { prisma } from "@/lib/prisma";

export interface GameGroup {
  group: string;
  games: Array<{
    id: string;
    result: "player" | "tie" | "banker";
  }>;
  stats: {
    playerCount: number;
    tieCount: number;
    bankerCount: number;
    firstGameDate: string | null;
    lastGameDate: string | null;
  };
}

export async function getTables(): Promise<string[]> {
  const tables = await prisma.game.findMany({
    select: {
      table: true,
    },
    distinct: ["table"],
    orderBy: {
      table: "asc",
    },
  });

  return tables.map((t) => t.table);
}

export async function getGameGroups(
  limit: number = 10,
  table?: string
): Promise<GameGroup[]> {
  // Construir o where clause baseado no filtro de mesa
  const whereClause: { table?: string } = {};
  if (table) {
    whereClause.table = table;
  }

  // Buscar todos os grupos únicos com a data do último jogo de cada grupo
  // Primeiro, vamos buscar os grupos com suas datas máximas
  const allGroups = await prisma.game.groupBy({
    by: ["group"],
    where: whereClause,
    _max: {
      createdAt: true,
    },
  });

  // Ordenar os grupos pela data do último jogo (mais recente primeiro)
  const sortedGroups = allGroups
    .sort((a, b) => {
      const dateA = a._max.createdAt?.getTime() || 0;
      const dateB = b._max.createdAt?.getTime() || 0;
      return dateB - dateA; // Ordem decrescente (mais recente primeiro)
    })
    .slice(0, limit); // Aplicar o limite

  // Para cada grupo, buscar os jogos
  const gameGroups: GameGroup[] = await Promise.all(
    sortedGroups.map(async ({ group }) => {
      const games = await prisma.game.findMany({
        where: {
          group,
          ...(table && { table }),
        },
        select: {
          id: true,
          result: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // Calcular estatísticas
      const playerCount = games.filter((g) => g.result === "player").length;
      const tieCount = games.filter((g) => g.result === "tie").length;
      const bankerCount = games.filter((g) => g.result === "banker").length;
      const firstGameDate =
        games.length > 0 ? games[0].createdAt.toISOString() : null;
      const lastGameDate =
        games.length > 0
          ? games[games.length - 1].createdAt.toISOString()
          : null;

      return {
        group,
        games: games.map((game) => ({
          id: game.id,
          result: game.result,
        })),
        stats: {
          playerCount,
          tieCount,
          bankerCount,
          firstGameDate,
          lastGameDate,
        },
      };
    })
  );

  return gameGroups;
}

