import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticPlugin from '@fastify/static'
import path from 'node:path'
import type { AppConfig } from './config.js'
import type { DbPool } from './db.js'
import { errorHandler } from './errors.js'
import { registerAuthRoutes } from './routes/authRoutes.js'
import { registerAdminRoutes } from './routes/adminRoutes.js'
import { registerSettingsRoutes } from './routes/settingsRoutes.js'
import { registerUsageRoutes } from './routes/usageRoutes.js'
import { registerImageRoutes } from './routes/imageRoutes.js'
import { ImageQueueWorker } from './services/imageQueue.js'

export interface AppContext {
  config: AppConfig
  db: DbPool
}

export async function createApp(context: AppContext) {
  const app = Fastify({
    logger: {
      level: context.config.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: context.config.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
    },
  })

  app.decorate('context', context)
  app.decorate('imageQueue', new ImageQueueWorker(context.db, {
    storageRoot: context.config.IMAGE_STORAGE_PATH,
    logger: app.log,
  }))
  app.setErrorHandler(errorHandler)

  await app.register(cors, { origin: true, credentials: true })
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 20,
    },
  })

  app.get('/health', async () => ({ ok: true }))
  app.get('/api/health', async () => ({ ok: true }))
  await registerAuthRoutes(app)
  await registerAdminRoutes(app)
  await registerSettingsRoutes(app)
  await registerUsageRoutes(app)
  await registerImageRoutes(app)

  app.addHook('onReady', async () => {
    app.imageQueue?.start()
  })
  app.addHook('onClose', async () => {
    app.imageQueue?.stop()
  })

  const publicDir = path.resolve(process.cwd(), 'dist')
  await app.register(staticPlugin, {
    root: publicDir,
    prefix: '/',
    cacheControl: false,
    setHeaders: (response, filePath) => {
      if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
        response.setHeader('Cache-Control', 'no-store')
        return
      }
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      }
    },
  })

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '接口不存在' } })
    }
    return reply.header('Cache-Control', 'no-store').sendFile('index.html')
  })

  return app
}
