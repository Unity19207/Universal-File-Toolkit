import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface NumberBaseOptions {
  fromBase: number
  toBase: number
  customFromBase: number
  customToBase: number
  processAll: boolean
  showPrefix: boolean
}

function resolveBase(base: number, customBase: number) {
  return base === 0 ? customBase : base
}

function stripKnownPrefix(value: string, base: number) {
  if (base === 16) return value.replace(/^0x/i, '')
  if (base === 2) return value.replace(/^0b/i, '')
  if (base === 8) return value.replace(/^0o/i, '')
  return value
}

function addPrefix(value: string, base: number) {
  if (base === 16) return `0x${value}`
  if (base === 2) return `0b${value}`
  if (base === 8) return `0o${value}`
  return value
}

function NumberBaseOptionsComponent({ options, onChange }: ToolOptionsComponentProps<NumberBaseOptions>) {
  return (
    <OptionsSection label="Base Settings">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-4">
          <OptionsSelect
            label="From Base"
            value={options.fromBase}
            onChange={(val) => onChange({ ...options, fromBase: Number(val) })}
            options={[
              { value: '10', label: 'Decimal (10)' },
              { value: '16', label: 'Hex (16)' },
              { value: '2', label: 'Binary (2)' },
              { value: '8', label: 'Octal (8)' },
              { value: '0', label: 'Custom' },
            ]}
          />
          {options.fromBase === 0 && (
            <OptionsInput
              label="Custom From Base"
              type="number"
              min={2}
              max={36}
              value={options.customFromBase}
              onChange={(val) => onChange({ ...options, customFromBase: Number(val) })}
              placeholder="2-36"
            />
          )}
        </div>
        <div className="space-y-4">
          <OptionsSelect
            label="To Base"
            value={options.toBase}
            onChange={(val) => onChange({ ...options, toBase: Number(val) })}
            options={[
              { value: '16', label: 'Hex (16)' },
              { value: '10', label: 'Decimal (10)' },
              { value: '2', label: 'Binary (2)' },
              { value: '8', label: 'Octal (8)' },
              { value: '0', label: 'Custom' },
            ]}
          />
          {options.toBase === 0 && (
            <OptionsInput
              label="Custom To Base"
              type="number"
              min={2}
              max={36}
              value={options.customToBase}
              onChange={(val) => onChange({ ...options, customToBase: Number(val) })}
              placeholder="2-36"
            />
          )}
        </div>
      </div>
      <div className="space-y-2 mt-4">
        <OptionsCheckbox
          label="Process each line separately"
          checked={options.processAll}
          onChange={(val) => onChange({ ...options, processAll: val })}
        />
        <OptionsCheckbox
          label="Show common prefixes (0x, 0b, 0o)"
          checked={options.showPrefix}
          onChange={(val) => onChange({ ...options, showPrefix: val })}
        />
      </div>
      <p className="text-xs text-secondary mt-2">
        Fast, offline number base conversion for binary, octal, decimal, and hex.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<NumberBaseOptions> = {
  defaultOptions: {
    fromBase: 10,
    toBase: 16,
    customFromBase: 10,
    customToBase: 16,
    processAll: true,
    showPrefix: true,
  },
  OptionsComponent: NumberBaseOptionsComponent,
  async run(files, options, helpers) {
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Processing...' })
    if (files.length === 0) return { outputs: [], preview: { kind: 'text', title: 'No input', summary: 'Paste content or upload a file to convert.', textContent: '', copyText: '' } }

    const input = files[0]
    const fromBase = resolveBase(options.fromBase, options.customFromBase)
    const toBase = resolveBase(options.toBase, options.customToBase)
    if (fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) throw new Error('Bases must be between 2 and 36.')

    helpers.onProgress({ phase: 'processing', value: 0.4, message: `Converting ${input.name}` })
    const raw = await input.file.text()
    const values = options.processAll ? raw.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) : [raw.trim()]
    if (values.length === 0) throw new Error('Provide at least one number to convert.')

    const output = values
      .map((value) => {
        const sanitized = stripKnownPrefix(value, fromBase)
        const parsed = parseInt(sanitized, fromBase)
        if (Number.isNaN(parsed)) throw new Error(`"${value}" is not a valid base-${fromBase} number.`)
        const converted = parsed.toString(toBase)
        return options.showPrefix ? addPrefix(converted, toBase) : converted
      })
      .join('\n')

    const blob = new Blob([output], { type: 'text/plain' })
    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-base.txt`, blob, type: 'text/plain', size: blob.size }],
      preview: {
        kind: 'text',
        title: 'Base conversion complete',
        summary: `${values.length} value${values.length === 1 ? '' : 's'} converted locally.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'From base', value: `${fromBase}` },
          { label: 'To base', value: `${toBase}` },
        ],
      },
    }
  },
}

export default module
