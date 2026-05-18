import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { DbClient } from '../db.js'

interface StoredFileInput {
  userId: string
  taskId: string
  dataUrl: string
  source: 'upload' | 'generated' | 'mask'
  storageRoot: string
}

export interface StoredFile {
  id: string
  dataUrl: string
  relativePath: string
  sha256: string
  mimeType: string
  sizeBytes: number
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Buffer } {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!match) throw new Error('图片数据格式不正确')
  const mimeType = match[1] || 'image/png'
  const isBase64 = Boolean(match[2])
  const payload = match[3] ?? ''
  const bytes = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload))
  return { mimeType, bytes }
}

function extensionFromMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return 'png'
}

export async function storeImageFile(client: DbClient, input: StoredFileInput): Promise<StoredFile> {
  const parsed = parseDataUrl(input.dataUrl)
  const sha256 = createHash('sha256').update(parsed.bytes).digest('hex')
  const ext = extensionFromMime(parsed.mimeType)
  const now = new Date()
  const relativeDir = path.posix.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'), input.userId)
  const filename = `${sha256}.${ext}`
  const relativePath = path.posix.join(relativeDir, filename)
  const absoluteDir = path.join(input.storageRoot, relativeDir)
  await mkdir(absoluteDir, { recursive: true })
  await writeFile(path.join(absoluteDir, filename), parsed.bytes)

  const result = await client.query<{ id: string }>(
    `
      insert into image_files (task_id, user_id, source, relative_path, sha256, mime_type, size_bytes)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id::text
    `,
    [input.taskId, input.userId, input.source, relativePath, sha256, parsed.mimeType, parsed.bytes.length],
  )

  return {
    id: result.rows[0].id,
    dataUrl: input.dataUrl,
    relativePath,
    sha256,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.bytes.length,
  }
}

export function dataUrlFromBytes(bytes: ArrayBuffer, mimeType: string): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`
}
