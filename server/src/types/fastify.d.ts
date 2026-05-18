import type { AppContext } from '../app.js'

declare module 'fastify' {
  interface FastifyInstance {
    context: AppContext
  }
}
