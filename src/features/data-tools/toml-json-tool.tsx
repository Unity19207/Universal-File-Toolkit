import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect } from '../../components/workspace/OptionsComponents'

interface TomlJsonOptions {
  direction: 'TOML to JSON' | 'JSON to TOML'
}

function TomlJsonOptionsComponent({ options, onChange }: ToolOptionsComponentProps<TomlJsonOptions>) {
  return (
    <OptionsSection label="Converter Configuration" noBorder>
      <OptionsSelect
        label="Format Direction"
        value={options.direction}
        onChange={(val) => onChange({ ...options, direction: val as TomlJsonOptions['direction'] })}
        options={[
          { value: 'TOML to JSON', label: 'TOML → JSON' },
          { value: 'JSON to TOML', label: 'JSON → TOML' },
        ]}
      />
      <p className="text-xs text-secondary mt-4">
        Transforms configuration data between formats locally while maintaining object structures.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<TomlJsonOptions> = {
  defaultOptions: { direction: 'TOML to JSON' },
  OptionsComponent: TomlJsonOptionsComponent,
  async run(files, options, helpers) {
    const TOML = await import('@iarna/toml')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.3, message: 'Reading configuration data...' })
    const text = await input.file.text()
    
    let result = ''
    let outName = ''
    let mime = 'text/plain'
    
    try {
      if (options.direction === 'TOML to JSON') {
        const parsed = TOML.parse(text)
        result = JSON.stringify(parsed, null, 2)
        outName = input.name.replace(/\.[^.]+$/, '') + '.json'
        mime = 'application/json'
      } else {
        const obj = JSON.parse(text)
        result = TOML.stringify(obj)
        outName = input.name.replace(/\.[^.]+$/, '') + '.toml'
        mime = 'application/toml'
      }
    } catch (e: any) {
      throw new Error(`Parse error: ${e.message}`)
    }
    
    const blob = new Blob([result], { type: mime })
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob, type: mime, size: blob.size }],
      preview: {
        kind: 'text',
        title: 'TOML ↔ JSON conversion complete',
        summary: `Successfully converted ${input.name} to ${outName}.`,
        textContent: result
      }
    }
  },
}

export default module
