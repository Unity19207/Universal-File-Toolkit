import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsSlider, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface BatchRenamerOptions {
  mode: 'Find & Replace' | 'Add prefix/suffix' | 'Sequential numbering'
  prefix: string
  suffix: string
  startNumber: number
  padZeros: number
  findText: string
  replaceText: string
  preserveExtension: boolean
}

function BatchRenamerOptionsComponent({ options, onChange }: ToolOptionsComponentProps<BatchRenamerOptions>) {
  return (
    <>
      <OptionsSection label="Strategy">
        <OptionsSelect
          label="Renaming Strategy"
          value={options.mode}
          onChange={(val) => onChange({ ...options, mode: val as BatchRenamerOptions['mode'] })}
          options={[
            { value: 'Sequential numbering', label: 'Sequential Numbering' },
            { value: 'Find & Replace', label: 'Find & Replace' },
            { value: 'Add prefix/suffix', label: 'Prefix / Suffix' },
          ]}
        />
      </OptionsSection>

      {options.mode === 'Sequential numbering' && (
        <OptionsSection label="Numbering Settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionsInput
              label="Start Number"
              type="number"
              value={options.startNumber}
              onChange={(val) => onChange({ ...options, startNumber: Number(val) })}
            />
            <OptionsSlider
              label="Padding (Zeros)"
              min={1}
              max={6}
              value={options.padZeros}
              onChange={(val) => onChange({ ...options, padZeros: val })}
            />
          </div>
        </OptionsSection>
      )}

      {options.mode === 'Find & Replace' && (
        <OptionsSection label="Replacement Settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionsInput
              label="Find Text"
              value={options.findText}
              onChange={(val) => onChange({ ...options, findText: val })}
            />
            <OptionsInput
              label="Replace With"
              value={options.replaceText}
              onChange={(val) => onChange({ ...options, replaceText: val })}
            />
          </div>
        </OptionsSection>
      )}

      {(options.mode === 'Sequential numbering' || options.mode === 'Add prefix/suffix') && (
        <OptionsSection label="Formatting">
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionsInput
              label="Prefix"
              value={options.prefix}
              onChange={(val) => onChange({ ...options, prefix: val })}
              placeholder="e.g. Photo_"
            />
            <OptionsInput
              label="Suffix"
              value={options.suffix}
              onChange={(val) => onChange({ ...options, suffix: val })}
              placeholder="e.g. _v2"
            />
          </div>
        </OptionsSection>
      )}

      <OptionsSection label="Global Settings" noBorder>
        <OptionsCheckbox
          label="Preserve original file extensions"
          checked={options.preserveExtension}
          onChange={(val) => onChange({ ...options, preserveExtension: val })}
        />
      </OptionsSection>
    </>
  )
}

const module: ToolModule<BatchRenamerOptions> = {
  defaultOptions: { mode: 'Sequential numbering', prefix: '', suffix: '', startNumber: 1, padZeros: 3, findText: '', replaceText: '', preserveExtension: true },
  OptionsComponent: BatchRenamerOptionsComponent,
  async run(files, options, helpers) {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    const manifest: Record<string, string> = {}

    let currentNumber = options.startNumber

    for (const [i, input] of files.entries()) {
      helpers.onProgress({ phase: 'processing', value: (i + 0.5) / files.length, message: `Renaming ${input.name}` })
      
      let baseName = input.name
      let ext = ''
      
      if (options.preserveExtension && input.name.includes('.')) {
        const parts = input.name.split('.')
        ext = '.' + parts.pop()
        baseName = parts.join('.')
      }

      let newBaseName = baseName

      if (options.mode === 'Find & Replace') {
        if (options.findText) {
          newBaseName = newBaseName.split(options.findText).join(options.replaceText)
        }
      } else if (options.mode === 'Sequential numbering') {
        const numStr = String(currentNumber).padStart(options.padZeros, '0')
        newBaseName = `${options.prefix}${numStr}${options.suffix}`
        currentNumber++
      } else if (options.mode === 'Add prefix/suffix') {
        newBaseName = `${options.prefix}${newBaseName}${options.suffix}`
      }

      const finalName = newBaseName + ext
      manifest[input.name] = finalName
      
      zip.file(finalName, await input.file.arrayBuffer())
    }

    helpers.onProgress({ phase: 'processing', value: 0.9, message: 'Bundling ZIP archive...' })
    zip.file('rename-manifest.json', JSON.stringify(manifest, null, 2))
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs: [{ id: crypto.randomUUID(), name: 'renamed-files.zip', blob: zipBlob, type: 'application/zip', size: zipBlob.size }],
      preview: { kind: 'text', title: 'Batch Renaming Complete', summary: `Renamed ${files.length} files successfully.`, textContent: JSON.stringify(manifest, null, 2), metadata: [{ label: 'Renamed Files', value: `${files.length}` }] }
    }
  },
}

export default module
