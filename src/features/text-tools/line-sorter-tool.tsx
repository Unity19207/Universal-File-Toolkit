import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface LineSorterOptions {
  operation: 'sort' | 'dedupe' | 'both'
  sortMode: 'az' | 'za' | 'length-asc' | 'length-desc' | 'numeric' | 'random'
  caseInsensitive: boolean
  trimLines: boolean
  removeEmpty: boolean
}

function dedupeLines(lines: string[], caseInsensitive: boolean) {
  const seen = new Set<string>()
  return lines.filter((line) => {
    const key = caseInsensitive ? line.toLowerCase() : line
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sortLines(lines: string[], sortMode: LineSorterOptions['sortMode'], caseInsensitive: boolean) {
  const next = [...lines]
  if (sortMode === 'random') {
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    }
    return next
  }

  const normalize = (value: string) => (caseInsensitive ? value.toLowerCase() : value)
  next.sort((left, right) => {
    if (sortMode === 'numeric') return Number(left) - Number(right)
    if (sortMode === 'length-asc') return left.length - right.length || normalize(left).localeCompare(normalize(right))
    if (sortMode === 'length-desc') return right.length - left.length || normalize(left).localeCompare(normalize(right))
    if (sortMode === 'za') return normalize(right).localeCompare(normalize(left))
    return normalize(left).localeCompare(normalize(right))
  })
  return next
}

function LineSorterOptionsComponent({ options, onChange }: ToolOptionsComponentProps<LineSorterOptions>) {
  return (
    <>
      <OptionsSection label="Primary Operation">
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionsSelect
            label="Method"
            value={options.operation}
            onChange={(val) => onChange({ ...options, operation: val as LineSorterOptions['operation'] })}
            options={[
              { value: 'sort', label: 'Sort Only' },
              { value: 'dedupe', label: 'Deduplicate Only' },
              { value: 'both', label: 'Sort + Deduplicate' },
            ]}
          />
          <OptionsSelect
            label="Sort Logic"
            value={options.sortMode}
            onChange={(val) => onChange({ ...options, sortMode: val as LineSorterOptions['sortMode'] })}
            options={[
              { value: 'az', label: 'Alphabetical A-Z' },
              { value: 'za', label: 'Alphabetical Z-A' },
              { value: 'length-asc', label: 'Shortest First' },
              { value: 'length-desc', label: 'Longest First' },
              { value: 'numeric', label: 'Numeric Growth' },
              { value: 'random', label: 'Random Shuffle' },
            ]}
          />
        </div>
      </OptionsSection>

      <OptionsSection label="Normalization" noBorder>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <OptionsCheckbox
            label="Ignore Case"
            checked={options.caseInsensitive}
            onChange={(val) => onChange({ ...options, caseInsensitive: val })}
          />
          <OptionsCheckbox
            label="Trim Lines"
            checked={options.trimLines}
            onChange={(val) => onChange({ ...options, trimLines: val })}
          />
          <OptionsCheckbox
            label="Strip Empty"
            checked={options.removeEmpty}
            onChange={(val) => onChange({ ...options, removeEmpty: val })}
          />
        </div>
        <p className="text-xs text-secondary mt-6">
          Processes unstructured text data in your browser memory. Ideal for lists, logs, and datasets.
        </p>
      </OptionsSection>
    </>
  )
}

const module: ToolModule<LineSorterOptions> = {
  defaultOptions: {
    operation: 'both',
    sortMode: 'az',
    caseInsensitive: true,
    trimLines: true,
    removeEmpty: true,
  },
  OptionsComponent: LineSorterOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.35, message: `Processing ${input.name}` })
    let lines = (await input.file.text()).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    if (options.trimLines) lines = lines.map((line) => line.trim())
    if (options.removeEmpty) lines = lines.filter((line) => line.length > 0)

    const originalCount = lines.length
    if (options.operation === 'dedupe' || options.operation === 'both') lines = dedupeLines(lines, options.caseInsensitive)
    const dedupedCount = lines.length
    if (options.operation === 'sort' || options.operation === 'both') lines = sortLines(lines, options.sortMode, options.caseInsensitive)

    const output = lines.join('\n')
    const blob = new Blob([output], { type: 'text/plain' })

    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-sorted.txt`, blob, type: 'text/plain', size: blob.size }],
      preview: {
        kind: 'text',
        title: 'Line processing complete',
        summary: `${input.name} was processed locally.`,
        textContent: output,
        copyText: output,
        metadata: [
          { label: 'Input lines', value: `${originalCount}` },
          { label: 'Output lines', value: `${lines.length}` },
          { label: 'Removed', value: `${Math.max(originalCount - dedupedCount, 0)}` },
        ],
      },
    }
  },
}

export default module
