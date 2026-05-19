import { describe, expect, it } from 'vitest'
import { buildApiUrl, normalizeDevProxyConfig } from './devProxy'

describe('buildApiUrl', () => {
  it('uses the same-origin proxy prefix when API proxy is enabled', () => {
    expect(buildApiUrl('http://api.example.com/v1', 'images/edits', null, true)).toBe(
      '/api-proxy/images/edits',
    )
  })

  it('keeps the v1 segment when the configured API URL does not include it', () => {
    expect(buildApiUrl('http://api.example.com', 'images/generations', null, true)).toBe(
      '/api-proxy/v1/images/generations',
    )
  })

  it('uses a configured proxy prefix when one is available', () => {
    expect(
      buildApiUrl(
        'http://api.example.com/v1',
        'responses',
        {
          enabled: true,
          prefix: '/openai-proxy',
          target: 'http://api.example.com/v1',
          changeOrigin: true,
          secure: false,
        },
        true,
      ),
    ).toBe('/openai-proxy/responses')
  })

  it('uses the configured API URL directly when API proxy is disabled', () => {
    expect(buildApiUrl('http://api.example.com/v1', 'responses', null, false)).toBe(
      'http://api.example.com/v1/responses',
    )
  })
})

describe('normalizeDevProxyConfig', () => {
  it('adds the v1 segment to a bare proxy target origin', () => {
    expect(normalizeDevProxyConfig({
      enabled: true,
      target: 'https://api.example.com',
    })?.target).toBe('https://api.example.com/v1')
  })

  it('keeps an explicit proxy target v1 segment', () => {
    expect(normalizeDevProxyConfig({
      enabled: true,
      target: 'https://api.example.com/v1',
    })?.target).toBe('https://api.example.com/v1')
  })
})
