import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface HtmlMinifierOptions {
  collapseWhitespace: boolean
  removeComments: boolean
  minifyJS: boolean
  minifyCSS: boolean
}

function HtmlMinifierOptionsComponent({ options, onChange }: ToolOptionsComponentProps<HtmlMinifierOptions>) {
  return (
    <OptionsSection label="Compression Strategies" noBorder>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <OptionsCheckbox
          label="Collapse Whitespace"
          checked={options.collapseWhitespace}
          onChange={(val) => onChange({ ...options, collapseWhitespace: val })}
        />
        <OptionsCheckbox
          label="Remove HTML Comments"
          checked={options.removeComments}
          onChange={(val) => onChange({ ...options, removeComments: val })}
        />
        <OptionsCheckbox
          label="Minify Inline JS (Terser)"
          checked={options.minifyJS}
          onChange={(val) => onChange({ ...options, minifyJS: val })}
        />
        <OptionsCheckbox
          label="Minify Inline CSS"
          checked={options.minifyCSS}
          onChange={(val) => onChange({ ...options, minifyCSS: val })}
        />
      </div>
      <p className="text-xs text-secondary mt-6">
        Enterprise-grade minification using the html-minifier-terser engine. Supports case-sensitive tags.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<HtmlMinifierOptions> = {
  defaultOptions: { collapseWhitespace: true, removeComments: true, minifyJS: true, minifyCSS: true },
  OptionsComponent: HtmlMinifierOptionsComponent,
  async run(files, options, helpers) {
    const { minify } = await import('html-minifier-terser')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Reading document bytes...' })
    const text = await input.file.text()
    
    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Executing minify-terser bridge...' })
    
    let result = ''
    try {
      result = await minify(text, {
        collapseWhitespace: options.collapseWhitespace,
        removeComments: options.removeComments,
        minifyJS: options.minifyJS,
        minifyCSS: options.minifyCSS,
        caseSensitive: true,
        removeEmptyAttributes: true
      })
    } catch (e: any) {
      throw new Error(`Minifier crash: ${e.message}`)
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-min.html`
    const resultBlob = new Blob([result], { type: 'text/html' })
    const saved = ((text.length - result.length) / text.length * 100).toFixed(1)

    return {
       outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: 'text/html', size: resultBlob.size }],
       preview: {
         kind: 'text',
         title: 'HTML Compression Complete',
         summary: `Reduced size by ${saved}%. Original: ${text.length} bytes. Minified: ${result.length} bytes.`,
         textContent: result
       }
    }
  },
}

export default module
