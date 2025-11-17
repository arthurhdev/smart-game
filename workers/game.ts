import dotenv from 'dotenv'
dotenv.config({
  path: ['.env.local', '.env'],
})
import WebSocket from 'ws'
import { shortUUID } from '@/lib/utils'
import { GameResult } from '@/types/websocket-message'
import { prisma } from '@/lib/prisma'
import * as Sentry from "@sentry/node";

if (!process.env.SENTRY_DSN) {
  console.warn('⚠️ SENTRY_DSN não configurado!')
  process.exit(1)
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

const gameSubdomain = process.env.GAME_SUBDOMAIN!
const gameSessionId = process.env.GAME_SESSION_ID!
const gameTableId = process.env.GAME_TABLE_ID!

const url = `wss://${gameSubdomain}.pragmaticplaylive.net/game?JSESSIONID=${gameSessionId}&tableId=${gameTableId}&type=json`

const ws = new WebSocket(url, {
  headers: {
    'Host': `${gameSubdomain}.pragmaticplaylive.net`,
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
        Sentry.captureMessage(`event.session | table: ${gameTableId} | ${message.toString()}`, 'log')
        await shutdown()
        break
    }
  }catch(error) {
    Sentry.captureException(error, {
      extra: {
        event: 'ws.message',
        table: gameTableId,
      }
    })
    await shutdown()
  }
})

ws.on('error', async (error: Error) => {
  Sentry.captureException(error, {
    extra: {
      event: 'ws.error',
      table: gameTableId,
    }
  })
  await Sentry.flush(2000) // Aguardar até 2 segundos para enviar eventos
  clearPingInterval()
  process.exit(1)
})

ws.on('close', async (code: number, reason: Buffer) => {
  Sentry.captureMessage(`ws.close | table: ${gameTableId} | code: ${code} | reason: ${reason.toString() || 'N/A'}`, 'log')
  await Sentry.flush(2000) // Aguardar até 2 segundos para enviar eventos
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

    // Aguardar o Sentry enviar todos os eventos pendentes antes de encerrar
    await Sentry.flush(2000); // Aguardar até 2 segundos para enviar eventos

    console.log("✔ Worker finalizado com segurança.");
    process.exit(0);
  } catch (error) {
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: {
          event: 'shutdown.error',
          table: gameTableId
        }
      })
      await Sentry.flush(2000); // Aguardar antes de encerrar
    }
    clearPingInterval();
    process.exit(1);
  }
}

// ⚠️ Captura Ctrl-C (terminal)
process.on("SIGINT", shutdown);

// ⚠️ Captura kills normais (PM2, Docker, sistemas)
process.on("SIGTERM", shutdown);