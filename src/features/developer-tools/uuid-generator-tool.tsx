import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

type IdType = 'uuidv4' | 'uuidv1' | 'ulid' | 'nanoid'
type OutputFormat = 'lines' | 'json' | 'sql'

interface UuidGeneratorOptions {
  type: IdType
  count: number
  format: OutputFormat
  uppercase: boolean
}

const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function generateUUIDv4(): string {
  return crypto.randomUUID()
}

function generateUUIDv1(): string {
  const now = Date.now()
  const timeLow = (now & 0xffffffff).toString(16).padStart(8, '0')
  const timeMid = ((now >>> 8) & 0xffff).toString(16).padStart(4, '0')
  const timeHi = (((now >>> 16) & 0x0fff) | 0x1000).toString(16).padStart(4, '0')
  const arr = new Uint8Array(8)
  crypto.getRandomValues(arr)
  const clockSeq = ((arr[0] & 0x3f) | 0x80).toString(16).padStart(2, '0') + arr[1].toString(16).padStart(2, '0')
  const node = Array.from(arr.slice(2), (b) => b.toString(16).padStart(2, '0')).join('')
  return `${timeLow}-${timeMid}-${timeHi}-${clockSeq}-${node}`
}

function generateULID(): string {
  const now = Date.now()
  let timeStr = ''
  let remaining = now
  for (let i = 0; i < 10; i++) {
    timeStr = CROCKFORD_BASE32[remaining % 32] + timeStr
    remaining = Math.floor(remaining / 32)
  }
  const randomBytes = new Uint8Array(10)
  crypto.getRandomValues(randomBytes)
  let randomStr = ''
  for (const byte of randomBytes) {
    randomStr += CROCKFORD_BASE32[byte % 32]
  }
  return (timeStr + randomStr).slice(0, 26)
}

function generateNanoId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  const bytes = new Uint8Array(21)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b & 63]).join('')
}

function generateId(type: IdType): string {
  switch (type) {
    case 'uuidv4':
      return generateUUIDv4()
    case 'uuidv1':
      return generateUUIDv1()
    case 'ulid':
      return generateULID()
    case 'nanoid':
      return generateNanoId()
  }
}

function formatIds(ids: string[], format: OutputFormat): string {
  switch (format) {
    case 'lines':
      return ids.join('\n')
    case 'json':
      return JSON.stringify(ids, null, 2)
    case 'sql':
      return `IN (\n  ${ids.map((id) => `'${id}'`).join(',\n  ')}\n)`
  }
}

function UuidGeneratorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<UuidGeneratorOptions>) {
  return (
    <OptionsSection label="ID Generator Settings" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="ID Specification"
          value={options.type}
          onChange={(val) => onChange({ ...options, type: val as IdType })}
          options={[
            { value: 'uuidv4', label: 'UUID v4 (Randomized)' },
            { value: 'uuidv1', label: 'UUID v1 (Time-based)' },
            { value: 'ulid', label: 'ULID (Lexicographically Sortable)' },
            { value: 'nanoid', label: 'NanoID (Safe & Compact)' },
          ]}
        />
        <OptionsInput
          label="Generation Quantity"
          type="number"
          min={1}
          max={100}
          value={options.count}
          onChange={(val) => onChange({ ...options, count: Math.min(100, Math.max(1, Number(val))) })}
        />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 items-end">
        <OptionsSelect
          label="Output Encapsulation"
          value={options.format}
          onChange={(val) => onChange({ ...options, format: val as OutputFormat })}
          options={[
            { value: 'lines', label: 'Raw String (Newlines)' },
            { value: 'json', label: 'JSON Data Array' },
            { value: 'sql', label: 'SQL "IN" Clause' },
          ]}
        />
        <div className="pb-3">
          <OptionsCheckbox
            label="Enforce Uppercase String"
            checked={options.uppercase}
            onChange={(val) => onChange({ ...options, uppercase: val })}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted mt-6">
        Generates high-entropy unique identifiers purely in-browser. 
        ULIDs include millisecond-precision timestamps in their prefix.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<UuidGeneratorOptions> = {
  defaultOptions: {
    type: 'uuidv4',
    count: 10,
    format: 'lines',
    uppercase: false,
  },
  OptionsComponent: UuidGeneratorOptionsComponent,
  async run(files, options, helpers) {
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Generating IDs…' })

    const ids: string[] = []
    for (let i = 0; i < options.count; i++) {
      ids.push(options.uppercase ? generateId(options.type).toUpperCase() : generateId(options.type))
      if (i % 500 === 0) {
        helpers.onProgress({
          phase: 'processing',
          value: Math.min(0.9, 0.1 + (i / options.count) * 0.8),
          message: `Generated ${i + 1} / ${options.count}`,
        })
      }
    }

    const output = formatIds(ids, options.format)
    const blob = new Blob([output], { type: 'text/plain' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    const inputName = files.length > 0 ? files[0].name.replace(/\.[^.]+$/, '') : 'generated'
    return {
      outputs: [{ id: crypto.randomUUID(), name: `${inputName}-ids.txt`, blob, type: 'text/plain', size: blob.size }],
      preview: {
        kind: 'text',
        title: `${options.count} IDs generated`,
        summary: `Generated ${options.count} ${options.type} identifiers locally.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Type', value: options.type },
          { label: 'Count', value: `${options.count}` },
          { label: 'Format', value: options.format },
        ],
      },
    }
  },
}

export default module
