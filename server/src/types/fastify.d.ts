import type { AppContext } from '../app.js'
import type { ImageQueueWorker } from '../services/imageQueue.js'

declare module 'fastify' {
  interface FastifyInstance {
    context: AppContext
    imageQueue?: ImageQueueWorker
  }
}
