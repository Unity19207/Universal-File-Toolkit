import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect } from '../../components/workspace/OptionsComponents'

interface CssMinifierOptions {
  level: 0 | 1 | 2
  format: 'beautify' | 'keep-breaks' | 'minify'
}

function CssMinifierOptionsComponent({ options, onChange }: ToolOptionsComponentProps<CssMinifierOptions>) {
  return (
    <OptionsSection label="Optimizer Settings">
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Optimization Level"
          value={options.level}
          onChange={(val) => onChange({ ...options, level: Number(val) as CssMinifierOptions['level'] })}
          options={[
            { value: '0', label: 'Level 0 (None)' },
            { value: '1', label: 'Level 1 (Basic)' },
            { value: '2', label: 'Level 2 (Advanced)' },
          ]}
        />
        <OptionsSelect
          label="Formatting Style"
          value={options.format}
          onChange={(val) => onChange({ ...options, format: val as CssMinifierOptions['format'] })}
          options={[
            { value: 'beautify', label: 'Beautify' },
            { value: 'keep-breaks', label: 'Keep line breaks' },
            { value: 'minify', label: 'Minify' },
          ]}
        />
      </div>
      <p className="text-xs text-secondary mt-2">
        Natively optimizes stylesheets using the Clean-CSS engine locally.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<CssMinifierOptions> = {
  defaultOptions: { level: 1, format: 'minify' },
  OptionsComponent: CssMinifierOptionsComponent,
  async run(files, options, helpers) {
    const CleanCSS = (await import('clean-css')).default
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Reading stylesheet records...' })
    const text = await input.file.text()
    
    helpers.onProgress({ phase: 'processing', value: 0.6, message: 'Executing Clean-CSS engine...' })
    
    const minifier = new CleanCSS({
      level: options.level,
      format: options.format === 'beautify' ? 'beautify' : options.format === 'keep-breaks' ? 'keep-breaks' : undefined
    })

    const output = minifier.minify(text)
    
    if (output.errors.length > 0) {
      throw new Error(`CSS parser error: ${output.errors[0]}`)
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const resultStr = output.styles
    const resultBlob = new Blob([resultStr], { type: 'text/css' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-min.css`
    const saved = ((text.length - resultStr.length) / text.length * 100).toFixed(1)

    return {
       outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: 'text/css', size: resultBlob.size }],
       preview: {
         kind: 'text',
         title: 'CSS Processing Complete',
         summary: `Reduced size by ${saved}%. Original: ${text.length} bytes. Minified: ${resultStr.length} bytes.`,
         textContent: resultStr
       }
    }
  },
}

export default module
