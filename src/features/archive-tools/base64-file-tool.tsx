import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox, OptionsInput } from '../../components/workspace/OptionsComponents'

interface Base64FileOptions {
  format: 'raw' | 'data-url' | 'css-url' | 'json'
  lineWrap: boolean
  wrapWidth: number
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function wrapText(value: string, width: number) {
  if (width <= 0) return value
  return value.match(new RegExp(`.{1,${width}}`, 'g'))?.join('\n') ?? value
}

function Base64FileOptionsComponent({ options, onChange }: ToolOptionsComponentProps<Base64FileOptions>) {
  return (
    <OptionsSection label="Encode Settings">
      <OptionsSelect
        label="Output Format"
        value={options.format}
        onChange={(val) => onChange({ ...options, format: val as Base64FileOptions['format'] })}
        options={[
          { value: 'raw', label: 'Raw Base64' },
          { value: 'data-url', label: 'Data URL' },
          { value: 'css-url', label: 'CSS url() value' },
          { value: 'json', label: 'JSON-ready string' },
        ]}
      />
      <OptionsCheckbox
        label="Wrap output text"
        checked={options.lineWrap}
        onChange={(val) => onChange({ ...options, lineWrap: val })}
      />
      {options.lineWrap && (
        <OptionsInput
          label="Wrap Width"
          type="number"
          min={16}
          value={options.wrapWidth}
          onChange={(val) => onChange({ ...options, wrapWidth: Number(val) })}
          placeholder="e.g. 76"
        />
      )}
    </OptionsSection>
  )
}

const module: ToolModule<Base64FileOptions> = {
  defaultOptions: {
    format: 'data-url',
    lineWrap: false,
    wrapWidth: 76,
  },
  OptionsComponent: Base64FileOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.4, message: `Encoding ${input.name}` })
    const base64 = arrayBufferToBase64(await input.file.arrayBuffer())
    const payload =
      options.format === 'raw'
        ? base64
        : options.format === 'data-url'
          ? `data:${input.type || 'application/octet-stream'};base64,${base64}`
          : options.format === 'css-url'
            ? `url("data:${input.type || 'application/octet-stream'};base64,${base64}")`
            : JSON.stringify(base64)
    const output = options.lineWrap ? wrapText(payload, options.wrapWidth) : payload
    const blob = new Blob([output], { type: 'text/plain' })

    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name}.b64.txt`, blob, type: 'text/plain', size: blob.size }],
      preview: {
        kind: 'text',
        title: 'Base64 output ready',
        summary: `${input.name} was encoded locally.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Source type', value: input.type || 'application/octet-stream' },
          { label: 'Format', value: options.format },
        ],
      },
    }
  },
}

export default module
