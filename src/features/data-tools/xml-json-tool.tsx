import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface XmlJsonOptions {
  direction: 'xml-to-json' | 'json-to-xml'
  preserveAttributes: boolean
  attributePrefix: string
  pretty: boolean
}

function XmlJsonOptionsComponent({ options, onChange }: ToolOptionsComponentProps<XmlJsonOptions>) {
  return (
    <OptionsSection label="Converter Configuration" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Conversion Pathway"
          value={options.direction}
          onChange={(val) => onChange({ ...options, direction: val as XmlJsonOptions['direction'] })}
          options={[
            { value: 'xml-to-json', label: 'XML → JSON' },
            { value: 'json-to-xml', label: 'JSON → XML' },
          ]}
        />
        <OptionsCheckbox
          label="Preserve attributes"
          checked={options.preserveAttributes}
          onChange={(val) => onChange({ ...options, preserveAttributes: val })}
        />
      </div>

      <div className="mt-6 space-y-4">
        {options.preserveAttributes && (
          <OptionsInput
            label="Attribute Name Prefix"
            value={options.attributePrefix}
            onChange={(val) => onChange({ ...options, attributePrefix: val })}
            placeholder="@_"
          />
        )}
        <OptionsCheckbox
          label="Pretty-print (Indented) output"
          checked={options.pretty}
          onChange={(val) => onChange({ ...options, pretty: val })}
        />
      </div>
      <p className="text-xs text-secondary mt-4">
        Local-first conversion using fast-xml-parser. Supports complex nested structures.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<XmlJsonOptions> = {
  defaultOptions: {
    direction: 'xml-to-json',
    preserveAttributes: true,
    attributePrefix: '@_',
    pretty: true,
  },
  OptionsComponent: XmlJsonOptionsComponent,
  async run(files, options, helpers) {
    const { XMLParser, XMLBuilder } = await import('fast-xml-parser')
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.3, message: `Converting ${input.name}` })
    const text = await input.file.text()

    let output: string
    let extension: string
    let mimeType: string

    if (options.direction === 'xml-to-json') {
      const parser = new XMLParser({
        ignoreAttributes: !options.preserveAttributes,
        attributeNamePrefix: options.attributePrefix,
      })
      const result: unknown = parser.parse(text)
      output = JSON.stringify(result, null, options.pretty ? 2 : 0)
      extension = 'json'
      mimeType = 'application/json'
    } else {
      const builder = new XMLBuilder({
        attributeNamePrefix: options.attributePrefix,
        ignoreAttributes: !options.preserveAttributes,
        format: options.pretty,
        indentBy: '  ',
      })
      const parsed: unknown = JSON.parse(text)
      output = builder.build(parsed) as string
      extension = 'xml'
      mimeType = 'application/xml'
    }

    const blob = new Blob([output], { type: mimeType })
    helpers.onProgress({ phase: 'finalizing', value: 1, message: `Converted ${input.name}` })

    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}.${extension}`, blob, type: mimeType, size: blob.size }],
      preview: {
        kind: extension === 'json' ? 'json' : 'text',
        title: `${options.direction === 'xml-to-json' ? 'XML → JSON' : 'JSON → XML'} conversion complete`,
        summary: `${input.name} was converted entirely in memory.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Direction', value: options.direction === 'xml-to-json' ? 'XML → JSON' : 'JSON → XML' },
          { label: 'Characters', value: `${output.length}` },
        ],
      },
    }
  },
}

export default module
