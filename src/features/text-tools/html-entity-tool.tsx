import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface HtmlEntityOptions {
  mode: 'encode' | 'decode'
  useNamedRefs: boolean
  allowUnsafe: boolean
}

function HtmlEntityOptionsComponent({ options, onChange }: ToolOptionsComponentProps<HtmlEntityOptions>) {
  return (
    <OptionsSection label="Entity Configuration" noBorder>
      <OptionsSelect
        label="Process Mode"
        value={options.mode}
        onChange={(val) => onChange({ ...options, mode: val as HtmlEntityOptions['mode'] })}
        options={[
          { value: 'encode', label: 'Encode (Text → Entities)' },
          { value: 'decode', label: 'Decode (Entities → Text)' },
        ]}
      />

      <div className="mt-6 space-y-4">
        {options.mode === 'encode' && (
          <>
            <OptionsCheckbox
              label="Use named references (&amp; instead of &#38;)"
              checked={options.useNamedRefs}
              onChange={(val) => onChange({ ...options, useNamedRefs: val })}
            />
            <OptionsCheckbox
              label="Allow unsafe symbols (skip encoding quotes)"
              checked={options.allowUnsafe}
              onChange={(val) => onChange({ ...options, allowUnsafe: val })}
            />
          </>
        )}
      </div>
      <p className="text-xs text-secondary mt-4">
        RFC-compliant entity mapping. Safeguards against XSS while maintaining valid HTML syntax.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<HtmlEntityOptions> = {
  defaultOptions: {
    mode: 'encode',
    useNamedRefs: true,
    allowUnsafe: false,
  },
  OptionsComponent: HtmlEntityOptionsComponent,
  async run(files, options, helpers) {
    const he = await import('he')
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.35, message: `Processing ${input.name}` })
    const text = await input.file.text()

    const output =
      options.mode === 'encode'
        ? he.encode(text, { useNamedReferences: options.useNamedRefs, allowUnsafeSymbols: options.allowUnsafe })
        : he.decode(text)

    const blob = new Blob([output], { type: input.type || 'text/html' })
    helpers.onProgress({ phase: 'finalizing', value: 1, message: `Processed ${input.name}` })

    return {
      outputs: [
        {
          id: crypto.randomUUID(),
          name: `${input.name.replace(/\.[^.]+$/, '')}-entities${input.name.match(/\.[^.]+$/)?.[0] ?? '.html'}`,
          blob,
          type: input.type || 'text/html',
          size: blob.size,
        },
      ],
      preview: {
        kind: 'text',
        title: `HTML entity ${options.mode} complete`,
        summary: `${input.name} was processed entirely in memory.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Mode', value: options.mode },
          { label: 'Characters', value: `${output.length}` },
        ],
      },
    }
  },
}

export default module
