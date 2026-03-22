import { describe, it, expect } from 'vitest'

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatAcceptedTypes(accepts: string[]): string {
  const typeMap: Record<string, string> = {
    'text/csv': 'CSV',
    'application/json': 'JSON',
    'text/plain': 'TXT',
    'application/pdf': 'PDF',
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
  }
  if (!accepts || accepts.length === 0) return 'Any file'
  return accepts
    .map((t) => typeMap[t.toLowerCase()] ?? t.split('/')[1]?.toUpperCase() ?? t)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ')
}

describe('formatFileSize', () => {
  it('formats bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1024 * 1024)).toBe('1 MB')
    expect(formatFileSize(25 * 1024 * 1024)).toBe('25 MB')
  })

  it('handles sub-KB values', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })
})

describe('formatAcceptedTypes', () => {
  it('maps MIME types to friendly names', () => {
    expect(formatAcceptedTypes(['text/csv'])).toBe('CSV')
    expect(formatAcceptedTypes(['text/csv', 'application/json'])).toBe('CSV, JSON')
    expect(formatAcceptedTypes([])).toBe('Any file')
  })

  it('deduplicates types', () => {
    expect(formatAcceptedTypes(['text/csv', 'text/csv'])).toBe('CSV')
  })

  it('handles unknown MIME types gracefully', () => {
    const result = formatAcceptedTypes(['application/zip'])
    expect(result).toBe('ZIP')
  })
})
