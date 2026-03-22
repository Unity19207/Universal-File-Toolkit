import { describe, expect, it } from 'vitest'
import { csvToJson, jsonToCsv, textToCsv } from '../features/data-tools/csv-json-tool'
import { normalizeText } from '../features/text-tools/text-formatter-tool'
import { validateFiles } from '../core/files/validation'
import { toolRegistry } from '../core/plugins/registry'

describe('CSV and JSON transforms', () => {
  it('converts csv text into json', () => {
    const json = csvToJson('name,age\nAda,36', true)
    expect(json).toContain('"name": "Ada"')
    expect(json).toContain('"age": 36')
  })

  it('converts json arrays into csv', () => {
    const csv = jsonToCsv(JSON.stringify([{ name: 'Ada', age: 36 }]))
    expect(csv).toContain('name,age')
    expect(csv).toContain('Ada,36')
  })

  it('converts plain text into a single-column csv fallback', () => {
    const csv = textToCsv('first line\nsecond line')
    expect(csv).toContain('value')
    expect(csv).toContain('first line')
    expect(csv).toContain('second line')
  })

  it('falls back to plain text when json parsing fails during csv conversion', () => {
    const csv = jsonToCsv('alpha\nbeta')
    expect(csv).toContain('value')
    expect(csv).toContain('alpha')
    expect(csv).toContain('beta')
  })

  it('normalizes loose mongo-like objects into json', () => {
    const input = `[
      {
        _id: ObjectId("6965004193ffbb50187b1253"),
        serialNumber: '5CD228F5QN',
        status: { en: { name: 'Active', value: 'Active' } }
      }
    ]`
    const json = csvToJson(input, true)
    expect(json).toContain('"_id": "6965004193ffbb50187b1253"')
    expect(json).toContain('"serialNumber": "5CD228F5QN"')
    expect(json).toContain('"name": "Active"')
  })

  it('flattens nested loose objects when converting to csv', () => {
    const input = `[
      {
        _id: ObjectId("6965004193ffbb50187b1253"),
        serialNumber: '5CD228F5QN',
        status: { en: { name: 'Active', value: 'Active' } }
      }
    ]`
    const csv = jsonToCsv(input)
    expect(csv).toContain('_id')
    expect(csv).toContain('status.en.name')
    expect(csv).toContain('6965004193ffbb50187b1253')
    expect(csv).toContain('Active')
  })
})

describe('text normalization', () => {
  it('normalizes line endings and trims shared indentation', () => {
    const output = normalizeText('    one\r\n    two  \r\n', 'lf', true)
    expect(output).toBe('one\ntwo')
  })
})

describe('file validation', () => {
  it('rejects unsupported types for a tool', () => {
    const pdfTool = toolRegistry.find((tool) => tool.id === 'pdf-merge')
    expect(pdfTool).toBeDefined()
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' })
    const issues = validateFiles([file], pdfTool!)
    expect(issues[0]?.code).toBe('type')
  })
})
