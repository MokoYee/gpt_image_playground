import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function badRequest(message: string): AppError {
  return new AppError(400, 'BAD_REQUEST', message)
}

export function unauthorized(message = '请先登录'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message)
}

export function forbidden(message = '无权访问'): AppError {
  return new AppError(403, 'FORBIDDEN', message)
}

export function notFound(message = '资源不存在'): AppError {
  return new AppError(404, 'NOT_FOUND', message)
}

export function conflict(message: string): AppError {
  return new AppError(409, 'CONFLICT', message)
}

export async function errorHandler(error: FastifyError | Error, _request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } })
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? '参数不合法' } })
  }
  _request.log.error(error)
  return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: '系统异常，请稍后重试' } })
}
