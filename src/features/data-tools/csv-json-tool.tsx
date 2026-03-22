import Papa from 'papaparse'
import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

type JsonRecord = Record<string, unknown>

interface CsvJsonOptions {
  target: 'json' | 'csv'
  pretty: boolean
}

function CsvJsonOptionsComponent({ options, onChange }: ToolOptionsComponentProps<CsvJsonOptions>) {
  return (
    <OptionsSection label="Conversion Settings">
      <OptionsSelect
        label="Convert to"
        value={options.target}
        onChange={(val) => onChange({ ...options, target: val as CsvJsonOptions['target'] })}
        options={[
          { value: 'json', label: 'JSON' },
          { value: 'csv', label: 'CSV' },
        ]}
      />
      <OptionsCheckbox
        label="Pretty-print JSON output"
        checked={options.pretty}
        onChange={(val) => onChange({ ...options, pretty: val })}
      />
    </OptionsSection>
  )
}

function normalizeLooseStructuredText(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\bObjectId\(\s*(['"])(.*?)\1\s*\)/g, '"$2"')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value: string) => `"${value.replace(/"/g, '\\"')}"`)
    .replace(/,\s*([}\]])/g, '$1')
}

function tryParseLooseData(text: string) {
  const normalized = normalizeLooseStructuredText(text.trim())
  return JSON.parse(normalized) as unknown
}

function flattenRecord(value: unknown, prefix = '', result: JsonRecord = {}) {
  if (Array.isArray(value)) {
    result[prefix] = value.map((entry) => (typeof entry === 'object' ? JSON.stringify(entry) : String(entry))).join(', ')
    return result
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as JsonRecord)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        flattenRecord(nested, nextPrefix, result)
      } else if (Array.isArray(nested)) {
        result[nextPrefix] = nested.map((entry) => (typeof entry === 'object' ? JSON.stringify(entry) : String(entry))).join(', ')
      } else {
        result[nextPrefix] = nested ?? ''
      }
    }
    return result
  }

  if (prefix) result[prefix] = value ?? ''
  return result
}

function toRowArray(data: unknown) {
  if (Array.isArray(data)) {
    return data.map((entry) => (entry && typeof entry === 'object' ? flattenRecord(entry) : { value: entry ?? '' }))
  }

  if (data && typeof data === 'object') {
    return [flattenRecord(data)]
  }

  throw new Error('Structured input must be an object or array.')
}

export function csvToJson(text: string, pretty: boolean) {
  try {
    const parsedLoose = tryParseLooseData(text)
    return JSON.stringify(parsedLoose, null, pretty ? 2 : 0)
  } catch {
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    })

    if (parsed.errors.length > 0) throw new Error(parsed.errors[0].message)
    return JSON.stringify(parsed.data, null, pretty ? 2 : 0)
  }
}

export function jsonToCsv(text: string) {
  try {
    const data = tryParseLooseData(text)
    return Papa.unparse(toRowArray(data))
  } catch {
    return textToCsv(text)
  }
}

export function textToCsv(text: string) {
  const rows = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ value: line }))

  if (rows.length === 0) throw new Error('Plain text input is empty.')
  return Papa.unparse(rows)
}

const module: ToolModule<CsvJsonOptions> = {
  defaultOptions: {
    target: 'json',
    pretty: true,
  },
  OptionsComponent: CsvJsonOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.3, message: `Reading ${input.name}` })
    const text = await input.file.text()
    const outputText = options.target === 'json' ? csvToJson(text, options.pretty) : jsonToCsv(text)
    const extension = options.target === 'json' ? 'json' : 'csv'
    const type = options.target === 'json' ? 'application/json' : 'text/csv'
    const blob = new Blob([outputText], { type })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: `Converted ${input.name}` })

    return {
      outputs: [
        {
          id: crypto.randomUUID(),
          name: `${input.name.replace(/\.[^.]+$/, '')}.${extension}`,
          blob,
          type,
          size: blob.size,
        },
      ],
      preview: {
        kind: options.target === 'json' ? 'json' : 'text',
        title: `${options.target.toUpperCase()} output ready`,
        summary: `Converted ${input.name} entirely in memory.`,
        textContent: outputText,
        copyText: outputText,
        metadata: [
          { label: 'Output type', value: type },
          { label: 'Characters', value: `${outputText.length}` },
        ],
      },
    }
  },
}

export default module
