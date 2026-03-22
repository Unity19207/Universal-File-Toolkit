import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface TextFormatterOptions {
  mode: 'normalize' | 'pretty-json' | 'minify-json'
  lineEndings: 'lf' | 'crlf'
  trim: boolean
}

function TextFormatterOptionsComponent({ options, onChange }: ToolOptionsComponentProps<TextFormatterOptions>) {
  return (
    <OptionsSection label="Formatting Rules" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Engine Mode"
          value={options.mode}
          onChange={(val) => onChange({ ...options, mode: val as TextFormatterOptions['mode'] })}
          options={[
            { value: 'normalize', label: 'Normalize Text' },
            { value: 'pretty-json', label: 'JSON Prettify' },
            { value: 'minify-json', label: 'JSON Minify' },
          ]}
        />
        <OptionsSelect
          label="Line Endings"
          value={options.lineEndings}
          onChange={(val) => onChange({ ...options, lineEndings: val as TextFormatterOptions['lineEndings'] })}
          options={[
            { value: 'lf', label: 'LF (Unix/macOS)' },
            { value: 'crlf', label: 'CRLF (Windows)' },
          ]}
        />
      </div>
      <div className="mt-6">
        <OptionsCheckbox
          label="Auto-trim & Dedent"
          checked={options.trim}
          onChange={(val) => onChange({ ...options, trim: val })}
        />
      </div>
      <p className="text-xs text-secondary mt-4">
        Cleans up indentation, whitespace, and line endings in a single pass. 
        JSON modes support validation and re-serialization.
      </p>
    </OptionsSection>
  )
}

export function normalizeText(text: string, lineEndings: 'lf' | 'crlf', trim: boolean) {
  let next = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (trim) {
    const lines = next.split('\n').map((line) => line.replace(/\s+$/g, ''))
    const nonEmpty = lines.filter((line) => line.trim().length > 0)
    const indent = nonEmpty.length ? Math.min(...nonEmpty.map((line) => line.match(/^\s*/)?.[0].length ?? 0)) : 0
    next = lines.map((line) => line.slice(indent)).join('\n').trim()
  }
  return lineEndings === 'crlf' ? next.replace(/\n/g, '\r\n') : next
}

const module: ToolModule<TextFormatterOptions> = {
  defaultOptions: {
    mode: 'normalize',
    lineEndings: 'lf',
    trim: true,
  },
  OptionsComponent: TextFormatterOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.4, message: `Formatting ${input.name}` })
    const text = await input.file.text()
    let output = text
    if (options.mode === 'normalize') output = normalizeText(text, options.lineEndings, options.trim)
    else if (options.mode === 'pretty-json') output = JSON.stringify(JSON.parse(text), null, 2)
    else output = JSON.stringify(JSON.parse(text))

    const blob = new Blob([output], { type: 'text/plain' })
    return {
      outputs: [
        {
          id: crypto.randomUUID(),
          name: `${input.name.replace(/\.[^.]+$/, '')}-formatted.txt`,
          blob,
          type: 'text/plain',
          size: blob.size,
        },
      ],
      preview: {
        kind: 'text',
        title: 'Text output ready',
        summary: `${input.name} was formatted locally.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Line endings', value: options.lineEndings.toUpperCase() },
          { label: 'Mode', value: options.mode },
        ],
      },
    }
  },
}

export default module
