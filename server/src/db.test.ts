import { describe, expect, it } from 'vitest'
import { normalizeDatabaseUrl } from './db.js'

describe('normalizeDatabaseUrl', () => {
  it('keeps a normal database url unchanged', () => {
    expect(normalizeDatabaseUrl('postgresql://user:pass@127.0.0.1:5432/app')).toBe(
      'postgresql://user:pass@127.0.0.1:5432/app',
    )
  })

  it('encodes reserved characters in database credentials', () => {
    expect(normalizeDatabaseUrl('postgresql://user:p@ss#word@db.example.com:5432/app')).toBe(
      'postgresql://user:p%40ss%23word@db.example.com:5432/app',
    )
  })

  it('does not double encode credentials that are already escaped', () => {
    expect(normalizeDatabaseUrl('postgresql://user:p%40ss%23word@db.example.com:5432/app')).toBe(
      'postgresql://user:p%40ss%23word@db.example.com:5432/app',
    )
  })

  it('accepts a pasted DATABASE_URL assignment as the value', () => {
    expect(normalizeDatabaseUrl('DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/app')).toBe(
      'postgresql://user:pass@127.0.0.1:5432/app',
    )
  })
})
