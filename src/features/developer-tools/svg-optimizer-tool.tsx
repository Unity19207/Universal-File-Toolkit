import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface SvgOptimizeOptions {
  multipass: boolean
  removeComments: boolean
  pretty: boolean
}

function SvgOptimizeOptionsComponent({ options, onChange }: ToolOptionsComponentProps<SvgOptimizeOptions>) {
  return (
    <OptionsSection label="Optimizer Tweaks" noBorder>
      <div className="grid gap-4 sm:grid-cols-3">
        <OptionsCheckbox
          label="Multipass Optimization"
          checked={options.multipass}
          onChange={(val) => onChange({ ...options, multipass: val })}
        />
        <OptionsCheckbox
          label="Strip Comments"
          checked={options.removeComments}
          onChange={(val) => onChange({ ...options, removeComments: val })}
        />
        <OptionsCheckbox
          label="Pretty-print (Indented)"
          checked={options.pretty}
          onChange={(val) => onChange({ ...options, pretty: val })}
        />
      </div>
      <p className="text-xs text-secondary mt-4">
        Optimizes vector graphics using the SVGO engine. Safely removes metadata, hidden shapes, and redundant coordinates.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<SvgOptimizeOptions> = {
  defaultOptions: { multipass: true, removeComments: true, pretty: false },
  OptionsComponent: SvgOptimizeOptionsComponent,
  async run(files, options, helpers) {
    const svgo = await import('svgo')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Parsing XML vector streams...' })
    const text = await input.file.text()
    
    helpers.onProgress({ phase: 'processing', value: 0.6, message: 'Executing SVGO optimization passes...' })
    
    let result = ''
    try {
      const optimized = svgo.optimize(text, {
        multipass: options.multipass,
        js2svg: { indent: 2, pretty: options.pretty },
        plugins: [
          'preset-default',
          'removeDimensions',
          'sortAttrs',
          ...(options.removeComments ? ['removeComments'] : [])
        ] as any
      })
      result = optimized.data
    } catch (e: any) {
      throw new Error(`SVGO error: ${e.message}`)
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const resultBlob = new Blob([result], { type: 'image/svg+xml' })
    const saved = ((text.length - result.length) / text.length * 100).toFixed(1)
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-opt.svg`

    return {
       outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: 'image/svg+xml', size: resultBlob.size }],
       preview: {
         kind: 'text',
         title: 'SVG Optimization Results',
         summary: `Compressed ${input.name} by ${saved}%. New size: ${result.length} bytes.`,
         textContent: result
       }
    }
  },
}

export default module
