import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsSlider, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface YamlJsonOptions {
  direction: 'yaml-to-json' | 'json-to-yaml'
  indent: number
  sortKeys: boolean
}

function YamlJsonOptionsComponent({ options, onChange }: ToolOptionsComponentProps<YamlJsonOptions>) {
  return (
    <OptionsSection label="Converter Settings">
      <OptionsSelect
        label="Direction"
        value={options.direction}
        onChange={(val) => onChange({ ...options, direction: val as YamlJsonOptions['direction'] })}
        options={[
          { value: 'yaml-to-json', label: 'YAML → JSON' },
          { value: 'json-to-yaml', label: 'JSON → YAML' },
        ]}
      />
      <OptionsSlider
        label="Indent (Spaces)"
        min={2}
        max={8}
        value={options.indent}
        onChange={(val) => onChange({ ...options, indent: val })}
      />
      <OptionsCheckbox
        label="Sort keys alphabetically"
        checked={options.sortKeys}
        onChange={(val) => onChange({ ...options, sortKeys: val })}
      />
    </OptionsSection>
  )
}

const module: ToolModule<YamlJsonOptions> = {
  defaultOptions: {
    direction: 'yaml-to-json',
    indent: 2,
    sortKeys: false,
  },
  OptionsComponent: YamlJsonOptionsComponent,
  async run(files, options, helpers) {
    const yaml = await import('js-yaml')
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.3, message: `Converting ${input.name}` })
    const text = await input.file.text()

    // Fix #5: recursive deep key sort helper
    function sortKeysDeep(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(sortKeysDeep)
      if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, sortKeysDeep(v)])
        )
      }
      return value
    }

    let output: string
    let extension: string
    let mimeType: string

    if (options.direction === 'yaml-to-json') {
      const parsed = yaml.load(text)
      // Fix #5: guard null/undefined YAML (e.g. empty file)
      if (parsed === null || parsed === undefined) throw new Error('YAML file is empty or contains only comments.')
      const toSerialize = options.sortKeys ? sortKeysDeep(parsed) : parsed
      output = JSON.stringify(toSerialize, null, options.indent)
      extension = 'json'
      mimeType = 'application/json'
    } else {
      const parsed = JSON.parse(text) as unknown
      output = yaml.dump(parsed, { indent: options.indent, sortKeys: options.sortKeys })
      extension = 'yaml'
      mimeType = 'text/yaml'
    }

    const blob = new Blob([output], { type: mimeType })
    helpers.onProgress({ phase: 'finalizing', value: 1, message: `Converted ${input.name}` })

    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}.${extension}`, blob, type: mimeType, size: blob.size }],
      preview: {
        kind: extension === 'json' ? 'json' : 'text',
        title: `${options.direction === 'yaml-to-json' ? 'YAML → JSON' : 'JSON → YAML'} conversion complete`,
        summary: `${input.name} was converted entirely in memory.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Direction', value: options.direction === 'yaml-to-json' ? 'YAML → JSON' : 'JSON → YAML' },
          { label: 'Characters', value: `${output.length}` },
        ],
      },
    }
  },
}

export default module
