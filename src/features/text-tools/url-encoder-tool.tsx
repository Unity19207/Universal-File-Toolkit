import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect } from '../../components/workspace/OptionsComponents'

interface UrlEncoderOptions {
  mode: 'encode' | 'decode'
  scope: 'component' | 'uri' | 'base64' | 'query'
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function transformQuery(line: string, mode: UrlEncoderOptions['mode']) {
  const prefix = line.startsWith('?') ? '?' : ''
  const source = line.startsWith('?') ? line.slice(1) : line
  const pairs = source.split('&').filter(Boolean)
  return `${prefix}${pairs
    .map((pair) => {
      const [rawKey = '', rawValue = ''] = pair.split('=')
      if (mode === 'encode') return `${encodeURIComponent(rawKey)}=${encodeURIComponent(rawValue)}`
      return `${decodeURIComponent(rawKey)}=${decodeURIComponent(rawValue)}`
    })
    .join('&')}`
}

function UrlEncoderOptionsComponent({ options, onChange }: ToolOptionsComponentProps<UrlEncoderOptions>) {
  return (
    <OptionsSection label="Encoding Protocol" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Direction"
          value={options.mode}
          onChange={(val) => onChange({ ...options, mode: val as UrlEncoderOptions['mode'] })}
          options={[
            { value: 'encode', label: 'Encode (Safe)' },
            { value: 'decode', label: 'Decode (Raw)' },
          ]}
        />
        <OptionsSelect
          label="Encoding Strategy"
          value={options.scope}
          onChange={(val) => onChange({ ...options, scope: val as UrlEncoderOptions['scope'] })}
          options={[
            { value: 'component', label: 'URI Component (Strict)' },
            { value: 'uri', label: 'Full URI (Relaxed)' },
            { value: 'base64', label: 'Base64 (Binary-Safe)' },
            { value: 'query', label: 'Query Parameter Pairs' },
          ]}
        />
      </div>
      <p className="text-xs text-secondary mt-6">
        Processes strings line-by-line using standard browser encoding APIs. 
        Query string mode handles key=value splitting automatically.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<UrlEncoderOptions> = {
  defaultOptions: {
    mode: 'encode',
    scope: 'component',
  },
  OptionsComponent: UrlEncoderOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.35, message: `Transforming ${input.name}` })
    const text = await input.file.text()
    const output = text
      .split(/\r?\n/)
      .map((line) => {
        if (!line) return ''
        if (options.scope === 'component') return options.mode === 'encode' ? encodeURIComponent(line) : decodeURIComponent(line)
        if (options.scope === 'uri') return options.mode === 'encode' ? encodeURI(line) : decodeURI(line)
        if (options.scope === 'base64') return options.mode === 'encode' ? encodeBase64(line) : decodeBase64(line)
        return transformQuery(line, options.mode)
      })
      .join('\n')

    const blob = new Blob([output], { type: 'text/plain' })
    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-url.txt`, blob, type: 'text/plain', size: blob.size }],
      preview: {
        kind: 'text',
        title: 'URL transform complete',
        summary: `${input.name} was transformed locally.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Mode', value: options.mode },
          { label: 'Scope', value: options.scope },
        ],
      },
    }
  },
}

export default module
