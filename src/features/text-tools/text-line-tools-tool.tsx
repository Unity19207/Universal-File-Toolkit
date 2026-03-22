import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput } from '../../components/workspace/OptionsComponents'

interface TextLineOptions {
  mode: 'Prefix/Suffix lines' | 'Filter by keyword' | 'Extract line ranges' | 'Shuffle lines'
  prefix: string
  suffix: string
  keyword: string
  range: string
}

function TextLineOptionsComponent({ options, onChange }: ToolOptionsComponentProps<TextLineOptions>) {
  return (
    <OptionsSection label="Line Utility Selector" noBorder>
      <OptionsSelect
        label="Active Operation"
        value={options.mode}
        onChange={(val) => onChange({ ...options, mode: val as TextLineOptions['mode'] })}
        options={[
          { value: 'Prefix/Suffix lines', label: 'Bulk Prefix/Suffix insertion' },
          { value: 'Filter by keyword', label: 'Filter lines by Keyword' },
          { value: 'Extract line ranges', label: 'Extract Line Ranges' },
          { value: 'Shuffle lines', label: 'Random Shuffle (Fisher-Yates)' },
        ]}
      />

      <div className="mt-8 space-y-4">
        {options.mode === 'Prefix/Suffix lines' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionsInput
              label="Prefix String"
              value={options.prefix}
              onChange={(val) => onChange({ ...options, prefix: val })}
              placeholder='e.g. "ITEM-"'
            />
            <OptionsInput
              label="Suffix String"
              value={options.suffix}
              onChange={(val) => onChange({ ...options, suffix: val })}
              placeholder='e.g. ";"'
            />
          </div>
        )}

        {options.mode === 'Filter by keyword' && (
          <OptionsInput
            label="Keyword Filter"
            value={options.keyword}
            onChange={(val) => onChange({ ...options, keyword: val })}
            placeholder="Include lines containing..."
          />
        )}

        {options.mode === 'Extract line ranges' && (
          <OptionsInput
            label="Range Selector"
            value={options.range}
            onChange={(val) => onChange({ ...options, range: val })}
            placeholder='e.g. "1-20, 50, 100-110"'
          />
        )}
      </div>
      <p className="text-xs text-secondary mt-6">
        Streamlined line-aware manipulation. No data is sent to external servers.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<TextLineOptions> = {
  defaultOptions: { mode: 'Prefix/Suffix lines', prefix: '', suffix: '', keyword: '', range: '1-100' },
  OptionsComponent: TextLineOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Parsing line buffers...' })
    const text = await input.file.text()
    let lines = text.split(/\r?\n/)
    
    let resultRows: string[] = []
    
    helpers.onProgress({ phase: 'processing', value: 0.5, message: `Executing ${options.mode} transform...` })

    if (options.mode === 'Prefix/Suffix lines') {
       resultRows = lines.map(l => options.prefix + l + options.suffix)
    } else if (options.mode === 'Filter by keyword') {
       resultRows = lines.filter(l => l.includes(options.keyword))
    } else if (options.mode === 'Shuffle lines') {
       resultRows = [...lines]
       for (let i = resultRows.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [resultRows[i], resultRows[j]] = [resultRows[j], resultRows[i]]
       }
    } else if (options.mode === 'Extract line ranges') {
       const targets = new Set<number>()
       options.range.split(',').forEach(part => {
          const [start, end] = part.split('-').map(s => parseInt(s.trim()))
          if (!isNaN(start)) {
             if (isNaN(end)) targets.add(start)
             else {
                for (let i = start; i <= end; i++) targets.add(i)
             }
          }
       })
       resultRows = lines.filter((_, i) => targets.has(i + 1))
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const resultStr = resultRows.join('\n')
    const resultBlob = new Blob([resultStr], { type: 'text/plain' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-processed.txt`

    return {
       outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: 'text/plain', size: resultBlob.size }],
       preview: {
         kind: 'text',
         title: 'Line Transformation Complete',
         summary: `Processed ${lines.length} lines into ${resultRows.length} outputs.`,
         textContent: resultStr
       }
    }
  },
}

export default module
