import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSlider } from '../../components/workspace/OptionsComponents'

interface FileTypeOptions {
  checkBufferLimit: number
}

function FileTypeOptionsComponent({ options, onChange }: ToolOptionsComponentProps<FileTypeOptions>) {
  return (
    <OptionsSection label="Detector Settings">
      <OptionsSlider
        label="Scan Buffer Limit (KB)"
        min={4}
        max={1024}
        step={32}
        value={options.checkBufferLimit}
        onChange={(val) => onChange({ ...options, checkBufferLimit: val })}
        displayValue={`${options.checkBufferLimit} KB`}
      />
      <p className="text-xs text-secondary mt-2">
        Inspects binary magic numbers in file headers to determine the real MIME type, regardless of file extension.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<FileTypeOptions> = {
  defaultOptions: { checkBufferLimit: 128 },
  OptionsComponent: FileTypeOptionsComponent,
  async run(files, _options, helpers) {
    const { fileTypeFromBlob } = await import('file-type')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.3, message: 'Sampling binary header bytes...' })
    
    const type = await fileTypeFromBlob(input.file)
    
    if (!type) throw new Error('Could not reliably determine this file type via magic header bytes.')

    const result = {
       fileName: input.name,
       extension: type.ext,
       mime: type.mime,
       detectedAt: new Date().toISOString()
    }
    const resultStr = JSON.stringify(result, null, 2)
    const resultBlob = new Blob([resultStr], { type: 'application/json' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-scan-type.json`

    return {
       outputs: [{ id: crypto.randomUUID(), name: outName, blob: resultBlob, type: 'application/json', size: resultBlob.size }],
       preview: {
         kind: 'text',
         title: 'File Type Identified',
         summary: `Detected ${type.mime.toUpperCase()} (${type.ext}) based on binary signature.`,
         textContent: resultStr,
         metadata: [{ label: 'Extension', value: type.ext }, { label: 'MIME', value: type.mime }]
       }
    }
  },
}

export default module
