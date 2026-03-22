import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface ZipExtractorOptions {
  flattenFolders: boolean
  skipMacOsFiles: boolean
}

function ZipExtractorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ZipExtractorOptions>) {
  return (
    <OptionsSection label="Extraction Settings">
      <OptionsCheckbox
        label="Flatten folder structure"
        checked={options.flattenFolders}
        onChange={(val) => onChange({ ...options, flattenFolders: val })}
      />
      <OptionsCheckbox
        label="Skip macOS metadata (__MACOSX, .DS_Store)"
        checked={options.skipMacOsFiles}
        onChange={(val) => onChange({ ...options, skipMacOsFiles: val })}
      />
    </OptionsSection>
  )
}

const module: ToolModule<ZipExtractorOptions> = {
  defaultOptions: { flattenFolders: false, skipMacOsFiles: true },
  OptionsComponent: ZipExtractorOptionsComponent,
  async run(files, options, helpers) {
    const JSZip = (await import('jszip')).default
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.1, message: `Reading ${input.name}` })
    
    const zip = new JSZip()
    const loadedZip = await zip.loadAsync(await input.file.arrayBuffer())
    
    const filesToExtract: Array<{ path: string; file: any }> = []
    loadedZip.forEach((relativePath, file) => {
      if (file.dir) return
      if (options.skipMacOsFiles && (relativePath.includes('__MACOSX/') || relativePath.endsWith('.DS_Store'))) return
      filesToExtract.push({ path: relativePath, file })
    })

    const outputs: Array<{ id: string; name: string; blob: Blob; type: string; size: number }> = []

    for (let i = 0; i < filesToExtract.length; i++) {
      helpers.onProgress({ phase: 'processing', value: 0.1 + (0.8 * (i + 1)) / filesToExtract.length, message: `Extracting ${i + 1} / ${filesToExtract.length}` })
      
      const { path, file } = filesToExtract[i]
      const finalName = options.flattenFolders ? path.split('/').pop() || path : path
      const buffer = await file.async('arraybuffer')
      const blob = new Blob([buffer])
      
      outputs.push({ id: crypto.randomUUID(), name: finalName, blob, type: blob.type || 'application/octet-stream', size: blob.size })
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs,
      preview: { kind: 'image', title: 'ZIP Extracted', summary: `${outputs.length} files extracted from ${input.name}.`, objectUrl: '', metadata: [{ label: 'Files', value: `${outputs.length}` }] },
    }
  },
}

export default module
