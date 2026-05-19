import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

export interface StoredFileRow {
  id: string
  dataUrl?: string
  relativePath: string
  sha256: string
  mimeType: string
  sizeBytes: number
  width?: number | null
  height?: number | null
  source?: 'upload' | 'generated' | 'mask'
}

export function mapStoredFileRow(row: any): StoredFileRow {
  return {
    id: row.id,
    relativePath: row.relative_path,
    sha256: row.sha256,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    source: row.source,
  }
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

export function dataUrlFromBytes(bytes: ArrayBuffer | Uint8Array, mimeType: string): string {
  const buffer = bytes instanceof ArrayBuffer ? Buffer.from(new Uint8Array(bytes)) : Buffer.from(bytes)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

export function resolveStoredImagePath(storageRoot: string, relativePath: string): string {
  const root = path.resolve(storageRoot)
  const fullPath = path.resolve(root, relativePath)
  if (!fullPath.startsWith(`${root}${path.sep}`) && fullPath !== root) {
    throw new Error('图片路径不合法')
  }
  return fullPath
}

export async function readStoredImageAsDataUrl(storageRoot: string, relativePath: string, mimeType: string): Promise<string> {
  const bytes = await readFile(resolveStoredImagePath(storageRoot, relativePath))
  return dataUrlFromBytes(bytes, mimeType)
}
