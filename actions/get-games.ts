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

export async function getGameGroups(limit: number = 10): Promise<GameGroup[]> {
  // Buscar os grupos únicos limitados
  const groups = await prisma.game.findMany({
    select: {
      group: true,
    },
    distinct: ["group"],
    take: limit,
    orderBy: {
      externalId: "desc",
    },
  });

  // Para cada grupo, buscar os jogos
  const gameGroups: GameGroup[] = await Promise.all(
    groups.map(async ({ group }) => {
      const games = await prisma.game.findMany({
        where: {
          group,
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

