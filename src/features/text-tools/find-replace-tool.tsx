import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface FindReplaceOptions {
  find: string
  replace: string
  useRegex: boolean
  caseInsensitive: boolean
  multiline: boolean
  replaceAll: boolean
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createRegex(options: FindReplaceOptions, forceGlobal = false) {
  const flags = `${options.caseInsensitive ? 'i' : ''}${options.multiline ? 'm' : ''}${options.replaceAll || forceGlobal ? 'g' : ''}`
  return new RegExp(options.useRegex ? options.find : escapeRegex(options.find), flags)
}

function FindReplaceOptionsComponent({ options, onChange }: ToolOptionsComponentProps<FindReplaceOptions>) {
  return (
    <>
      <OptionsSection label="Pattern Matcher">
        <div className="space-y-4">
          <OptionsInput
            label="Find Pattern"
            value={options.find}
            onChange={(val) => onChange({ ...options, find: val })}
            placeholder="Text or regex to find"
          />
          <OptionsInput
            label="Replace With"
            value={options.replace}
            onChange={(val) => onChange({ ...options, replace: val })}
            placeholder="Replacement text"
          />
        </div>
      </OptionsSection>

      <OptionsSection label="Search Modifiers" noBorder>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OptionsCheckbox
            label="Use Regular Expression"
            checked={options.useRegex}
            onChange={(val) => onChange({ ...options, useRegex: val })}
          />
          <OptionsCheckbox
            label="Ignore Case"
            checked={options.caseInsensitive}
            onChange={(val) => onChange({ ...options, caseInsensitive: val })}
          />
          <OptionsCheckbox
            label="Multiline Mode"
            checked={options.multiline}
            onChange={(val) => onChange({ ...options, multiline: val })}
          />
          <OptionsCheckbox
            label="Replace All Matches"
            checked={options.replaceAll}
            onChange={(val) => onChange({ ...options, replaceAll: val })}
          />
        </div>
        <p className="text-xs text-secondary mt-6">
          High-performance text transformation. Regex engine uses standard JavaScript flavor.
        </p>
      </OptionsSection>
    </>
  )
}

const module: ToolModule<FindReplaceOptions> = {
  defaultOptions: {
    find: '',
    replace: '',
    useRegex: false,
    caseInsensitive: false,
    multiline: false,
    replaceAll: true,
  },
  OptionsComponent: FindReplaceOptionsComponent,
  async run(files, options, helpers) {
    if (!options.find) throw new Error('Enter a search pattern before processing.')
    const outputs = []
    let totalMatches = 0
    let firstOutputText = ''

    for (const [index, input] of files.entries()) {
      helpers.onProgress({
        phase: 'processing',
        value: Math.min(0.85, (index + 1) / files.length),
        message: `Updating ${input.name}`,
      })
      const text = await input.file.text()
      const matchRegex = createRegex(options, true)
      const replaceRegex = createRegex(options)
      const matches = [...text.matchAll(matchRegex)]
      totalMatches += matches.length
      const outputText = text.replace(replaceRegex, options.replace)
      if (!firstOutputText) firstOutputText = outputText
      const blob = new Blob([outputText], { type: input.type || 'text/plain' })
      outputs.push({
        id: crypto.randomUUID(),
        name: `${input.name.replace(/\.[^.]+$/, '')}-updated${input.name.match(/\.[^.]+$/)?.[0] ?? '.txt'}`,
        blob,
        type: input.type || 'text/plain',
        size: blob.size,
      })
    }

    return {
      outputs,
      preview: {
        kind: 'text',
        title: 'Find and replace complete',
        summary: `Processed ${files.length} file${files.length === 1 ? '' : 's'} entirely in memory.`,
        textContent: firstOutputText,
        copyText: firstOutputText,
        metadata: [
          { label: 'Files', value: `${files.length}` },
          { label: 'Matches found', value: `${totalMatches}` },
          { label: 'Pattern type', value: options.useRegex ? 'Regex' : 'Plain text' },
        ],
      },
    }
  },
}

export default module
