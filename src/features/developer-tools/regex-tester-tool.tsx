import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface RegexTesterOptions {
  pattern: string
  flags: string
  showGroups: boolean
  outputMode: 'matches' | 'replace'
  replaceWith: string
}

function RegexTesterOptionsComponent({ options, onChange }: ToolOptionsComponentProps<RegexTesterOptions>) {
  return (
    <OptionsSection label="Regular Expression">
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsInput
          label="Pattern"
          value={options.pattern}
          onChange={(val) => onChange({ ...options, pattern: val })}
          placeholder="Regex without slashes"
        />
        <OptionsInput
          label="Flags"
          value={options.flags}
          onChange={(val) => onChange({ ...options, flags: val })}
          placeholder="e.g. g, i, m"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mt-4 items-end">
        <OptionsSelect
          label="Output Mode"
          value={options.outputMode}
          onChange={(val) => onChange({ ...options, outputMode: val as RegexTesterOptions['outputMode'] })}
          options={[
            { value: 'matches', label: 'List Matches' },
            { value: 'replace', label: 'Find & Replace' },
          ]}
        />
        {options.outputMode === 'replace' && (
          <OptionsInput
            label="Replace With"
            value={options.replaceWith}
            onChange={(val) => onChange({ ...options, replaceWith: val })}
            placeholder="Replacement text"
          />
        )}
      </div>

      <div className="mt-4">
        <OptionsCheckbox
          label="Include capture groups in JSON output"
          checked={options.showGroups}
          onChange={(val) => onChange({ ...options, showGroups: val })}
        />
      </div>
      <p className="text-xs text-secondary mt-2">
        Tests patterns locally using JavaScript's native RegExp engine.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<RegexTesterOptions> = {
  defaultOptions: {
    pattern: '',
    flags: 'g',
    showGroups: true,
    outputMode: 'matches',
    replaceWith: '',
  },
  OptionsComponent: RegexTesterOptionsComponent,
  async run(files, options, helpers) {
    if (!options.pattern) throw new Error('Enter a regex pattern before processing.')
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Processing...' })
    if (files.length === 0) return { outputs: [], preview: { kind: 'text', title: 'No input', summary: 'Paste content or upload a file to test regex.', textContent: '', copyText: '' } }

    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.35, message: `Testing ${input.name}` })
    const text = await input.file.text()
    const regex = new RegExp(options.pattern, options.flags)
    const scanRegex = new RegExp(options.pattern, options.flags.includes('g') ? options.flags : `${options.flags}g`)

    if (options.outputMode === 'replace') {
      const replaced = text.replace(regex, options.replaceWith)
      const blob = new Blob([replaced], { type: 'text/plain' })
      helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
      return {
        outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-regex.txt`, blob, type: 'text/plain', size: blob.size }],
        preview: {
          kind: 'text',
          title: 'Regex replace complete',
          summary: `${input.name} was transformed locally.`,
          textContent: replaced,
          copyText: replaced,
          metadata: [
            { label: 'Pattern', value: options.pattern },
            { label: 'Flags', value: options.flags || '(none)' },
          ],
        },
      }
    }

    const matches = [...text.matchAll(scanRegex)].map((match) => ({
      match: match[0],
      index: match.index ?? 0,
      length: match[0].length,
      groups: options.showGroups ? match.slice(1) : undefined,
    }))

    const result = {
      pattern: options.pattern,
      flags: options.flags,
      totalMatches: matches.length,
      matches,
    }
    const output = JSON.stringify(result, null, 2)
    const blob = new Blob([output], { type: 'application/json' })
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-regex.json`, blob, type: 'application/json', size: blob.size }],
      preview: {
        kind: 'json',
        title: 'Regex matches ready',
        summary: `${matches.length} match${matches.length === 1 ? '' : 'es'} found locally.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Matches', value: `${matches.length}` },
          { label: 'Flags', value: options.flags || '(none)' },
        ],
      },
    }
  },
}

export default module
