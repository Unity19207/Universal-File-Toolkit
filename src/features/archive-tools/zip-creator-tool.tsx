import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput, OptionsSlider } from '../../components/workspace/OptionsComponents'

interface ZipCreatorOptions {
  filename: string
  compressionLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
}

function ZipCreatorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ZipCreatorOptions>) {
  return (
    <OptionsSection label="Archive Settings">
      <OptionsInput
        label="Archive Filename"
        value={options.filename}
        onChange={(val) => onChange({ ...options, filename: val })}
        placeholder="archive"
      />
      <OptionsSlider
        label="Compression Level"
        min={0}
        max={9}
        value={options.compressionLevel}
        onChange={(val) => onChange({ ...options, compressionLevel: val as ZipCreatorOptions['compressionLevel'] })}
        displayValue={`${options.compressionLevel} (Store to Max)`}
      />
    </OptionsSection>
  )
}

const module: ToolModule<ZipCreatorOptions> = {
  defaultOptions: { filename: 'archive', compressionLevel: 6 },
  OptionsComponent: ZipCreatorOptionsComponent,
  async run(files, options, helpers) {
    if (!options.filename.trim()) throw new Error('Filename cannot be empty.')
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    
    for (const [i, input] of files.entries()) {
      helpers.onProgress({ phase: 'processing', value: (i / files.length) * 0.8, message: `Adding ${input.name}` })
      zip.file(input.name, await input.file.arrayBuffer())
    }

    helpers.onProgress({ phase: 'processing', value: 0.85, message: 'Compressing archive...' })
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: options.compressionLevel === 0 ? 'STORE' : 'DEFLATE',
      compressionOptions: { level: options.compressionLevel },
    })
    
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const finalName = `${options.filename.replace(/\.zip$/i, '')}.zip`

    return {
      outputs: [{ id: crypto.randomUUID(), name: finalName, blob: zipBlob, type: 'application/zip', size: zipBlob.size }],
      preview: { kind: 'download', title: 'ZIP Generated', summary: `${files.length} files compressed into ${finalName}.`, metadata: [{ label: 'Size', value: `${(zipBlob.size / 1024).toFixed(1)} KB` }, { label: 'Files', value: `${files.length}` }] },
    }
  },
}

export default module
