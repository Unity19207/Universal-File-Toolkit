import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface WordCounterOptions {
  stripHtml: boolean
  language: 'english' | 'other'
}

function countSyllables(word: string) {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!normalized) return 0
  const groups = normalized.match(/[aeiouy]+/g)?.length ?? 0
  return Math.max(groups - (normalized.endsWith('e') ? 1 : 0), 1)
}

function WordCounterOptionsComponent({ options, onChange }: ToolOptionsComponentProps<WordCounterOptions>) {
  return (
    <OptionsSection label="Analysis Parameters" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Linguistic Model"
          value={options.language}
          onChange={(val) => onChange({ ...options, language: val as WordCounterOptions['language'] })}
          options={[
            { value: 'english', label: 'English (Syllable-aware)' },
            { value: 'other', label: 'Other (Token-only)' },
          ]}
        />
        <div className="pt-8">
          <OptionsCheckbox
            label="Sanitize HTML content"
            checked={options.stripHtml}
            onChange={(val) => onChange({ ...options, stripHtml: val })}
          />
        </div>
      </div>
      <p className="text-xs text-secondary mt-6">
        Calculates Flesch Reading Ease and estimated read time using localized tokenization. 
        HTML sanitization ensures structural tags don&apos;t inflate word counts.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<WordCounterOptions> = {
  defaultOptions: {
    stripHtml: true,
    language: 'english',
  },
  OptionsComponent: WordCounterOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.4, message: `Counting ${input.name}` })
    const raw = await input.file.text()
    const text = options.stripHtml ? raw.replace(/<[^>]+>/g, ' ') : raw
    const words = text.trim().split(/\s+/).filter(Boolean)
    const sentences = text.split(/[.!?]+/).filter((value) => value.trim().length > 0)
    const paragraphs = text.split(/\n\s*\n+/).filter((value) => value.trim().length > 0)
    const syllables = options.language === 'english' ? words.reduce((sum, word) => sum + countSyllables(word), 0) : 0
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1)
    const avgSyllablesPerWord = syllables / Math.max(words.length, 1)
    const readTimeMinutes = words.length / 238
    const readability = options.language === 'english' ? 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord : null

    const stats = {
      characters: text.length,
      charactersNoSpaces: text.replace(/\s/g, '').length,
      words: words.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      averageWordsPerSentence: Number(avgWordsPerSentence.toFixed(2)),
      averageCharactersPerWord: Number((text.replace(/\s/g, '').length / Math.max(words.length, 1)).toFixed(2)),
      estimatedReadTimeMinutes: Number(readTimeMinutes.toFixed(2)),
      readabilityScore: readability === null ? null : Number(readability.toFixed(2)),
    }

    const output = JSON.stringify(stats, null, 2)
    const blob = new Blob([output], { type: 'application/json' })
    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-stats.json`, blob, type: 'application/json', size: blob.size }],
      preview: {
        kind: 'json',
        title: 'Text statistics ready',
        summary: `${input.name} was analyzed locally.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Words', value: `${stats.words}` },
          { label: 'Read time', value: `${stats.estimatedReadTimeMinutes} min` },
          { label: 'Readability', value: stats.readabilityScore === null ? 'Not calculated' : `${stats.readabilityScore}` },
        ],
      },
    }
  },
}

export default module
