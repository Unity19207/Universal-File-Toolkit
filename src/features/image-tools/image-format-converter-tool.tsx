import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsSlider } from '../../components/workspace/OptionsComponents'

interface ImageFormatOptions {
  outputFormat: 'image/jpeg' | 'image/png' | 'image/webp'
  quality: number
  background: string
}

function ImageFormatOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ImageFormatOptions>) {
  return (
    <OptionsSection label="Conversion Settings" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Output Format"
          value={options.outputFormat}
          onChange={(val) => onChange({ ...options, outputFormat: val as ImageFormatOptions['outputFormat'] })}
          options={[
            { value: 'image/webp', label: 'WebP (Modern)' },
            { value: 'image/jpeg', label: 'JPEG (Compact)' },
            { value: 'image/png', label: 'PNG (Lossless)' },
          ]}
        />
        {options.outputFormat === 'image/jpeg' && (
          <OptionsInput
            label="Background Color"
            type="color"
            value={options.background}
            onChange={(val) => onChange({ ...options, background: val })}
          />
        )}
      </div>

      {options.outputFormat !== 'image/png' && (
        <div className="mt-6">
          <OptionsSlider
            label="Quality"
            min={35}
            max={100}
            value={options.quality}
            onChange={(val) => onChange({ ...options, quality: val })}
          />
        </div>
      )}
      <p className="text-xs text-secondary mt-4">
        Change image formats instantly using high-quality browser encoding.
      </p>
    </OptionsSection>
  )
}

const extMap: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

const module: ToolModule<ImageFormatOptions> = {
  defaultOptions: { outputFormat: 'image/webp', quality: 85, background: '#ffffff' },
  OptionsComponent: ImageFormatOptionsComponent,
  async run(files, options, helpers) {
    const outputs = []
    for (const [i, input] of files.entries()) {
      helpers.onProgress({ phase: 'processing', value: (i + 0.5) / files.length, message: `Converting ${input.name}` })
      const bitmap = await createImageBitmap(input.file)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')!
      if (options.outputFormat === 'image/jpeg') {
        ctx.fillStyle = options.background
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      const blob = await canvas.convertToBlob({ type: options.outputFormat, quality: options.quality / 100 })
      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}${extMap[options.outputFormat]}`, blob, type: options.outputFormat, size: blob.size })
    }
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs,
      preview: { kind: 'image' as const, title: 'Format conversion complete', summary: `Converted ${files.length} image(s).`, objectUrl: URL.createObjectURL(outputs[0].blob), metadata: [{ label: 'Format', value: options.outputFormat }, { label: 'Files', value: `${outputs.length}` }] },
    }
  },
}

export default module
