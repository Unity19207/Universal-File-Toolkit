import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

type LoremUnit = 'words' | 'sentences' | 'paragraphs'
type LoremFormat = 'plain' | 'html' | 'markdown'

interface LoremIpsumOptions {
  unit: LoremUnit
  count: number
  startWithLorem: boolean
  format: LoremFormat
}

function LoremIpsumOptionsComponent({ options, onChange }: ToolOptionsComponentProps<LoremIpsumOptions>) {
  return (
    <OptionsSection label="Generation Settings" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Structure Unit"
          value={options.unit}
          onChange={(val) => onChange({ ...options, unit: val as LoremUnit })}
          options={[
            { value: 'words', label: 'Words (Inline)' },
            { value: 'sentences', label: 'Sentences' },
            { value: 'paragraphs', label: 'Paragraphs (Block)' },
          ]}
        />
        <OptionsInput
          label="Volume"
          type="number"
          min={1}
          max={100}
          value={options.count}
          onChange={(val) => onChange({ ...options, count: Math.min(100, Math.max(1, Number(val))) })}
        />
      </div>
      <div className="mt-6 space-y-4">
        <OptionsSelect
          label="Output Syntax"
          value={options.format}
          onChange={(val) => onChange({ ...options, format: val as LoremFormat })}
          options={[
            { value: 'plain', label: 'Plain Unformatted Text' },
            { value: 'html', label: 'Semantic HTML (<p> tags)' },
            { value: 'markdown', label: 'Markdown Syntax' },
          ]}
        />
        <OptionsCheckbox
          label="Begin with standard 'Lorem ipsum...' lead-in"
          checked={options.startWithLorem}
          onChange={(val) => onChange({ ...options, startWithLorem: val })}
        />
      </div>
      <p className="text-[11px] text-muted mt-6">
        Generates deterministic pseudo-Latin placeholder text based on the 
        standard Cicero "De finibus bonorum et malorum" passage.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<LoremIpsumOptions> = {
  defaultOptions: {
    unit: 'paragraphs',
    count: 5,
    startWithLorem: true,
    format: 'plain',
  },
  OptionsComponent: LoremIpsumOptionsComponent,
  async run(files, options, helpers) {
    const { LoremIpsum } = await import('lorem-ipsum')
    helpers.onProgress({ phase: 'processing', value: 0.3, message: 'Generating lorem ipsum…' })

    const lorem = new LoremIpsum({
      sentencesPerParagraph: { max: 8, min: 4 },
      wordsPerSentence: { max: 16, min: 4 },
    })

    let text: string
    switch (options.unit) {
      case 'words':
        text = lorem.generateWords(options.count)
        break
      case 'sentences':
        text = lorem.generateSentences(options.count)
        break
      case 'paragraphs':
        text = lorem.generateParagraphs(options.count)
        break
    }

    if (options.startWithLorem) {
      const prefix = 'Lorem ipsum dolor sit amet'
      const firstSpace = text.indexOf(' ', 1)
      if (firstSpace > 0 && text.length > prefix.length) {
        const restStart = Math.min(prefix.length, text.length)
        const rest = text.slice(restStart).replace(/^\s*,?\s*/, ', ')
        text = prefix + rest
      } else {
        text = prefix + '. ' + text
      }
    }

    let output: string
    switch (options.format) {
      case 'html': {
        const paragraphs = text.split(/\n\n|\r?\n/)
        output = paragraphs.map((p) => `<p>${p.trim()}</p>`).join('\n')
        break
      }
      case 'markdown':
        output = text.replace(/\n/g, '\n\n')
        break
      default:
        output = text
    }

    const blob = new Blob([output], { type: 'text/plain' })
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    const inputName = files.length > 0 ? files[0].name.replace(/\.[^.]+$/, '') : 'lorem'
    const ext = options.format === 'html' ? 'html' : options.format === 'markdown' ? 'md' : 'txt'
    const mime = options.format === 'html' ? 'text/html' : 'text/plain'

    return {
      outputs: [{ id: crypto.randomUUID(), name: `${inputName}-ipsum.${ext}`, blob: new Blob([output], { type: mime }), type: mime, size: blob.size }],
      preview: {
        kind: 'text',
        title: 'Lorem ipsum generated',
        summary: `Generated ${options.count} ${options.unit} of placeholder text.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Unit', value: options.unit },
          { label: 'Count', value: `${options.count}` },
          { label: 'Format', value: options.format },
        ],
      },
    }
  },
}

export default module
