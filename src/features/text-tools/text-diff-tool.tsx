import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface TextDiffOptions {
  mode: 'Side by side diff' | 'Unified patch' | 'HTML diff'
  ignoreCase: boolean
  ignoreWhitespace: boolean
}

function TextDiffOptionsComponent({ options, onChange }: ToolOptionsComponentProps<TextDiffOptions>) {
  return (
    <OptionsSection label="Comparison Protocol" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Visualization Strategy"
          value={options.mode}
          onChange={(val) => onChange({ ...options, mode: val as TextDiffOptions['mode'] })}
          options={[
            { value: 'Side by side diff', label: 'Side by Side Comparison' },
            { value: 'Unified patch', label: 'Unified Patch format' },
            { value: 'HTML diff', label: 'Rich HTML Report' },
          ]}
        />
        <div className="space-y-4">
          <OptionsCheckbox
            label="Ignore case differences"
            checked={options.ignoreCase}
            onChange={(val) => onChange({ ...options, ignoreCase: val })}
          />
          <OptionsCheckbox
            label="Ignore trailing whitespace"
            checked={options.ignoreWhitespace}
            onChange={(val) => onChange({ ...options, ignoreWhitespace: val })}
          />
        </div>
      </div>
      <p className="text-xs text-secondary mt-6">
        Applies Myers' O(ND) algorithm to identify character-level deltas. No data leaves your local context.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<TextDiffOptions> = {
  defaultOptions: { mode: 'Side by side diff', ignoreCase: false, ignoreWhitespace: false },
  OptionsComponent: TextDiffOptionsComponent,
  async run(files, options, helpers) {
    const diff = await import('diff')
    
    if (files.length < 2) throw new Error('You must upload two files to perform a comparison.')
    
    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Ingesting file streams...' })
    const oldStr = await files[0].file.text()
    const newStr = await files[1].file.text()
    
    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Calculating diff changes...' })
    
    let resultStr = ''
    let mime = 'text/plain'
    
    if (options.mode === 'Unified patch') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resultStr = (diff as any).createPatch(files[0].name, oldStr, newStr, '', '', {
        ignoreCase: options.ignoreCase,
        ignoreWhitespace: options.ignoreWhitespace
      }) as string
      mime = 'text/x-patch'
    } else if (options.mode === 'Side by side diff') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changes = (diff as any).diffLines(oldStr, newStr, {
        ignoreCase: options.ignoreCase,
        ignoreWhitespace: options.ignoreWhitespace
      }) as any[]

      resultStr = changes.map(part => {
        const sign = part.added ? '+ ' : part.removed ? '- ' : '  '
        const val = part.value || ''
        return val.split('\n').filter(Boolean).map((line: string) => sign + line).join('\n')
      }).filter(Boolean).join('\n')

    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changes = (diff as any).diffWordsWithSpace(oldStr, newStr, {
        ignoreCase: options.ignoreCase,
        ignoreWhitespace: options.ignoreWhitespace
      }) as any[]

      resultStr = '<div style="font-family: monospace; white-space: pre-wrap; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff;">'
      ;changes.forEach(part => {
        const color = part.added ? '#dcfce7' : part.removed ? '#fee2e2' : 'transparent'
        const decor = part.removed ? 'text-decoration: line-through;' : ''
        const val = part.value || ''
        resultStr += `<span style="background: ${color}; ${decor}">${val.replace(/</g, '&lt;')}</span>`
      })
      resultStr += '</div>'
      mime = 'text/html'
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const resultBlob = new Blob([resultStr], { type: mime })
    const outName = `diff-${files[0].name.replace(/\.[^.]+$/, '')}-vs-${files[1].name.replace(/\.[^.]+$/, '')}.${options.mode === 'HTML diff' ? 'html' : 'patch'}`

    return {
       outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: mime, size: resultBlob.size }],
       preview: {
         kind: 'text',
         title: 'Text Diffing Results',
         summary: `Compared ${files[0].name} and ${files[1].name}.`,
         textContent: options.mode === 'HTML diff' ? 'HTML report generated - click download to view full colors.' : resultStr
       }
    }
  },
}

export default module
