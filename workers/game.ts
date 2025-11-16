import dotenv from 'dotenv'
dotenv.config({
  path: ['.env.local', '.env'],
})
import WebSocket from 'ws'
import { shortUUID } from '@/lib/utils'
import { GameResult } from '@/types/websocket-message'
import { prisma } from '@/lib/prisma'

const gameSessionId = process.env.GAME_SESSION_ID!
const gameTableId = process.env.GAME_TABLE_ID!

const url = `wss://gs19.pragmaticplaylive.net/game?JSESSIONID=${gameSessionId}&tableId=${gameTableId}&type=json`

console.log(url)

const ws = new WebSocket(url, {
  headers: {
    'Host': 'gs19.pragmaticplaylive.net',
    'Connection': 'Upgrade',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Upgrade': 'websocket',
    'Origin': 'https://client.pragmaticplaylive.net',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  },
})

let pingInterval: NodeJS.Timeout | null = null

const clearPingInterval = () => {
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }
}

ws.on('open', () => {
  console.log('Connected to the game table')

  pingInterval = setInterval(() => {
    ws.send(`<ping channel="table-${gameTableId}" time="${Date.now()}"/>`)
  }, 10000)
})

let gameGroupId = shortUUID()

ws.on('message', async (message: Buffer) => {
  try {
    const type = message.toString().match(/^\{"\w+"|<session>/g)?.[0].replace(/{|"|<|>/g, '')

    switch (type) {
      case 'gameresult':
        const data: GameResult = JSON.parse(message.toString())?.gameresult
        await prisma.game.create({
          data: {
            externalId: data.id,
            table: data.table,
            result: data.result,
            score: parseInt(data.score),
            group: gameGroupId
          }
        })
        break
  
      case 'startshuffling':
        gameGroupId = shortUUID()
        break
  
      case 'session':
        console.log(message.toString())
        shutdown()
        break
    }
  }catch(error) {
    console.error(error)
    shutdown()
  }
})

ws.on('error', (error: Error) => {
  console.error(error)
  clearPingInterval()
  process.exit(1)
})

ws.on('close', (code: number, reason: Buffer) => {
  console.log(`Disconnected from the game table. Code: ${code}, Reason: ${reason.toString() || 'N/A'}`)
  clearPingInterval()
  process.exit(0)
})

// =======================================================
// GRACEFUL SHUTDOWN – FECHAMENTO CORRETO DO WORKER
// =======================================================

async function shutdown() {
  console.log("\n⏳ Encerrando worker...");

  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log("🔒 Fechando conexão WebSocket...");
      ws.close();
      clearPingInterval();
    }

    // console.log("📦 Encerrando conexão com o Prisma...");
    // await prisma.$disconnect();

    console.log("✔ Worker finalizado com segurança.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao encerrar:", err);
    clearPingInterval();
    process.exit(1);
  }
}

// ⚠️ Captura Ctrl-C (terminal)
process.on("SIGINT", shutdown);

// ⚠️ Captura kills normais (PM2, Docker, sistemas)
process.on("SIGTERM", shutdown);