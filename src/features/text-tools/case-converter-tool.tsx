import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect } from '../../components/workspace/OptionsComponents'

type CaseTarget =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'screaming-snake'
  | 'dot'

interface CaseConverterOptions {
  targetCase: CaseTarget
  scope: 'document' | 'line'
}

function getWords(input: string) {
  return input
    .normalize('NFKC')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_./-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function toTitle(words: string[]) {
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}

function toSentence(text: string) {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return ''
  return normalized.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
}

function convertValue(input: string, targetCase: CaseTarget) {
  const words = getWords(input)
  switch (targetCase) {
    case 'upper':
      return input.toUpperCase()
    case 'lower':
      return input.toLowerCase()
    case 'title':
      return toTitle(words)
    case 'sentence':
      return toSentence(input)
    case 'camel':
      return words
        .map((word, index) => (index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
        .join('')
    case 'pascal':
      return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('')
    case 'snake':
      return words.map((word) => word.toLowerCase()).join('_')
    case 'kebab':
      return words.map((word) => word.toLowerCase()).join('-')
    case 'screaming-snake':
      return words.map((word) => word.toUpperCase()).join('_')
    case 'dot':
      return words.map((word) => word.toLowerCase()).join('.')
  }
}

function CaseConverterOptionsComponent({ options, onChange }: ToolOptionsComponentProps<CaseConverterOptions>) {
  return (
    <OptionsSection label="Converter Configuration" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Target Case"
          value={options.targetCase}
          onChange={(val) => onChange({ ...options, targetCase: val as CaseTarget })}
          options={[
            { value: 'upper', label: 'UPPERCASE' },
            { value: 'lower', label: 'lowercase' },
            { value: 'title', label: 'Title Case' },
            { value: 'sentence', label: 'Sentence Case' },
            { value: 'camel', label: 'camelCase' },
            { value: 'pascal', label: 'PascalCase' },
            { value: 'snake', label: 'snake_case' },
            { value: 'kebab', label: 'kebab-case' },
            { value: 'screaming-snake', label: 'SCREAMING_SNAKE' },
            { value: 'dot', label: 'dot.case' },
          ]}
        />
        <OptionsSelect
          label="Conversion Scope"
          value={options.scope}
          onChange={(val) => onChange({ ...options, scope: val as CaseConverterOptions['scope'] })}
          options={[
            { value: 'document', label: 'Entire Document' },
            { value: 'line', label: 'Line by Line' },
          ]}
        />
      </div>
      <p className="text-xs text-secondary mt-4">
        Multi-paradigm string transformation. Supports code-safe naming conventions (camel, snake, kebab).
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<CaseConverterOptions> = {
  defaultOptions: {
    targetCase: 'title',
    scope: 'document',
  },
  OptionsComponent: CaseConverterOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.35, message: `Converting ${input.name}` })
    const text = await input.file.text()
    const output =
      options.scope === 'line' ? text.split(/\r?\n/).map((line) => convertValue(line, options.targetCase)).join('\n') : convertValue(text, options.targetCase)
    const blob = new Blob([output], { type: 'text/plain' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: `Converted ${input.name}` })
    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-case.txt`, blob, type: 'text/plain', size: blob.size }],
      preview: {
        kind: 'text',
        title: 'Case conversion complete',
        summary: `${input.name} was converted entirely in memory.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Target', value: options.targetCase },
          { label: 'Scope', value: options.scope === 'line' ? 'Each line' : 'Entire document' },
        ],
      },
    }
  },
}

export default module
