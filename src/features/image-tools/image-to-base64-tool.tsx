import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface ImageBase64Options {
  mode: 'encode' | 'decode'
  includeDataUri: boolean
  outputFormat: 'image/png' | 'image/jpeg' | 'image/webp'
}

function ImageBase64OptionsComponent({ options, onChange }: ToolOptionsComponentProps<ImageBase64Options>) {
  return (
    <OptionsSection label="Codec Options" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Mode"
          value={options.mode}
          onChange={(val) => onChange({ ...options, mode: val as ImageBase64Options['mode'] })}
          options={[
            { value: 'encode', label: 'Image → Base64' },
            { value: 'decode', label: 'Base64 → Image' },
          ]}
        />
        {options.mode === 'decode' && (
          <OptionsSelect
            label="Output Image Format"
            value={options.outputFormat}
            onChange={(val) => onChange({ ...options, outputFormat: val as ImageBase64Options['outputFormat'] })}
            options={[
              { value: 'image/png', label: 'PNG' },
              { value: 'image/jpeg', label: 'JPEG' },
              { value: 'image/webp', label: 'WebP' },
            ]}
          />
        )}
      </div>

      {options.mode === 'encode' && (
        <div className="mt-4">
          <OptionsCheckbox
            label="Include Data URI prefix (e.g. data:image/png;base64,...)"
            checked={options.includeDataUri}
            onChange={(val) => onChange({ ...options, includeDataUri: val })}
          />
        </div>
      )}
      <p className="text-xs text-secondary mt-4">
        Bi-directional conversion between image binary and Base64 text.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<ImageBase64Options> = {
  defaultOptions: { mode: 'encode', includeDataUri: true, outputFormat: 'image/png' },
  OptionsComponent: ImageBase64OptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.3, message: `Processing ${input.name}` })

    if (options.mode === 'encode') {
      const buffer = await input.file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      let base64 = btoa(binary)
      if (options.includeDataUri) base64 = `data:${input.type || 'image/png'};base64,${base64}`
      const blob = new Blob([base64], { type: 'text/plain' })
      helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Encoded' })
      return {
        outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-base64.txt`, blob, type: 'text/plain', size: blob.size }],
        preview: { kind: 'text', title: 'Image encoded to Base64', summary: `${input.name} encoded locally.`, textContent: base64, copyText: base64, metadata: [{ label: 'Length', value: `${base64.length} chars` }] },
      }
    } else {
      const text = (await input.file.text()).trim()
      const cleaned = text.replace(/^data:[^;]+;base64,/, '')
      const binary = atob(cleaned)
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
      const imgBlob = new Blob([bytes], { type: options.outputFormat })
      const extMap: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }
      helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Decoded' })
      return {
        outputs: [{ id: crypto.randomUUID(), name: `decoded-image${extMap[options.outputFormat]}`, blob: imgBlob, type: options.outputFormat, size: imgBlob.size }],
        preview: { kind: 'image', title: 'Base64 decoded to image', summary: 'Image decoded locally.', objectUrl: URL.createObjectURL(imgBlob), metadata: [{ label: 'Size', value: `${(imgBlob.size / 1024).toFixed(1)} KB` }] },
      }
    }
  },
}

export default module
