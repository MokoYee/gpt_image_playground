import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { unauthorized, forbidden } from './errors.js'
import type { DbPool } from './db.js'

export type UserRole = 'user' | 'admin'
export type UserStatus = 'enabled' | 'disabled' | 'deleted'

export interface AuthUser {
  id: string
  username: string
  email: string
  role: UserRole
  status: UserStatus
}

const encoder = new TextEncoder()

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(secret: string, expiresInSeconds: number, user: AuthUser): Promise<string> {
  return new SignJWT({
    username: user.username,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(encoder.encode(secret))
}

export async function verifyToken(secret: string, token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, encoder.encode(secret))
  if (!payload.sub) throw unauthorized()
  return { userId: payload.sub }
}

export async function getAuthUser(pool: DbPool, userId: string): Promise<AuthUser | null> {
  const result = await pool.query<AuthUser>(
    'select id::text, username, email, role, status from users where id = $1 and status <> $2',
    [userId, 'deleted'],
  )
  return result.rows[0] ?? null
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
  if (!token) throw unauthorized()
  const { config, db } = request.server.context
  const payload = await verifyToken(config.JWT_SECRET, token)
  const user = await getAuthUser(db, payload.userId)
  if (!user || user.status !== 'enabled') throw unauthorized('账号不可用，请重新登录')
  request.user = user
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply)
  if (request.user.role !== 'admin') throw forbidden('仅管理员可操作')
}
