import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface SlugGeneratorOptions {
  separator: '-' | '_' | '.'
  lowercase: boolean
  maxLength: number
  removeStopWords: boolean
}

const stopWords = new Set(['a', 'an', 'the', 'is', 'in', 'it', 'of', 'for', 'to', 'and', 'or', 'but', 'with', 'at', 'by', 'from'])

/**
 * Converts a string into a URL-friendly slug.
 */
function toSlug(input: string, options: SlugGeneratorOptions) {
  const words = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !(options.removeStopWords && stopWords.has(word.toLowerCase())))
    .map((word) => (options.lowercase ? word.toLowerCase() : word))

  if (words.length === 0) return ''
  const separator = options.separator
  if (options.maxLength <= 0) return words.join(separator)

  const built: string[] = []
  let currentLen = 0
  for (const word of words) {
    const nextLen = currentLen + word.length + (built.length > 0 ? 1 : 0)
    if (nextLen > options.maxLength) break
    built.push(word)
    currentLen = nextLen
  }
  return built.join(separator)
}

function SlugGeneratorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<SlugGeneratorOptions>) {
  return (
    <OptionsSection label="Slug Settings">
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Separator"
          value={options.separator}
          onChange={(val) => onChange({ ...options, separator: val as SlugGeneratorOptions['separator'] })}
          options={[
            { value: '-', label: 'Hyphen (-)' },
            { value: '_', label: 'Underscore (_)' },
            { value: '.', label: 'Dot (.)' },
          ]}
        />
        <OptionsInput
          label="Max Length (0 = None)"
          type="number"
          min={0}
          value={options.maxLength}
          onChange={(val) => onChange({ ...options, maxLength: Number(val) })}
          placeholder="0"
        />
      </div>
      <div className="space-y-2 mt-4">
        <OptionsCheckbox
          label="Lowercase output"
          checked={options.lowercase}
          onChange={(val) => onChange({ ...options, lowercase: val })}
        />
        <OptionsCheckbox
          label="Remove common stop words (a, an, the, etc.)"
          checked={options.removeStopWords}
          onChange={(val) => onChange({ ...options, removeStopWords: val })}
        />
      </div>
      <p className="text-xs text-secondary mt-2">
        Creates URL-safe slugs from text using local normalization and filtering.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<SlugGeneratorOptions> = {
  defaultOptions: {
    separator: '-',
    lowercase: true,
    maxLength: 0,
    removeStopWords: false,
  },
  OptionsComponent: SlugGeneratorOptionsComponent,
  async run(files, options, helpers) {
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Processing...' })
    if (files.length === 0) return { outputs: [], preview: { kind: 'text', title: 'No input', summary: 'Paste content or upload a file to slugify.', textContent: '', copyText: '' } }

    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.4, message: `Generating slugs from ${input.name}` })
    const lines = (await input.file.text()).split(/\r?\n/).filter((line) => line.trim().length > 0)
    const output = lines.map((line) => toSlug(line, options)).join('\n')
    const blob = new Blob([output], { type: 'text/plain' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-slugs.txt`, blob, type: 'text/plain', size: blob.size }],
      preview: {
        kind: 'text',
        title: 'Slug generation complete',
        summary: `${lines.length} input line${lines.length === 1 ? '' : 's'} converted locally.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Separator', value: options.separator },
          { label: 'Lowercase', value: options.lowercase ? 'Yes' : 'No' },
        ],
      },
    }
  },
}

export default module
