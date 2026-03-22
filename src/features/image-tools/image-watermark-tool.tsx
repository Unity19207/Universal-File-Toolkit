import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsSlider } from '../../components/workspace/OptionsComponents'

type WatermarkPosition = 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

interface ImageWatermarkOptions {
  text: string
  position: WatermarkPosition
  opacity: number
  fontSize: number
  color: string
  outputFormat: 'image/jpeg' | 'image/png' | 'image/webp'
}

function ImageWatermarkOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ImageWatermarkOptions>) {
  return (
    <>
      <OptionsSection label="Watermark Content">
        <OptionsInput
          label="Text"
          value={options.text}
          onChange={(val) => onChange({ ...options, text: val })}
          placeholder="e.g. DRAFT or CONFIDENTIAL"
        />
        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <OptionsSelect
            label="Position"
            value={options.position}
            onChange={(val) => onChange({ ...options, position: val as WatermarkPosition })}
            options={[
              { value: 'center', label: 'Center' },
              { value: 'top-left', label: 'Top Left' },
              { value: 'top-right', label: 'Top Right' },
              { value: 'bottom-left', label: 'Bottom Left' },
              { value: 'bottom-right', label: 'Bottom Right' },
            ]}
          />
          <OptionsInput
            label="Color"
            type="color"
            value={options.color}
            onChange={(val) => onChange({ ...options, color: val })}
          />
        </div>
      </OptionsSection>

      <OptionsSection label="Styling & Export" noBorder>
        <div className="space-y-6">
          <OptionsSlider
            label="Opacity"
            min={10}
            max={100}
            value={options.opacity}
            onChange={(val) => onChange({ ...options, opacity: val })}
          />
          <OptionsSlider
            label="Font Size (px)"
            min={12}
            max={120}
            value={options.fontSize}
            onChange={(val) => onChange({ ...options, fontSize: val })}
          />
          <OptionsSelect
            label="Output Format"
            value={options.outputFormat}
            onChange={(val) => onChange({ ...options, outputFormat: val as ImageWatermarkOptions['outputFormat'] })}
            options={[
              { value: 'image/jpeg', label: 'JPEG' },
              { value: 'image/png', label: 'PNG' },
              { value: 'image/webp', label: 'WebP' },
            ]}
          />
        </div>
        <p className="text-xs text-secondary mt-4">
          Adds a text-based watermark layer directly to your images using browser canvas rendering.
        </p>
      </OptionsSection>
    </>
  )
}

const extMap: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

const module: ToolModule<ImageWatermarkOptions> = {
  defaultOptions: { text: 'CONFIDENTIAL', position: 'bottom-right', opacity: 40, fontSize: 32, color: '#ffffff', outputFormat: 'image/jpeg' },
  OptionsComponent: ImageWatermarkOptionsComponent,
  async run(files, options, helpers) {
    if (!options.text.trim()) throw new Error('Enter watermark text.')
    const outputs = []
    for (const [i, input] of files.entries()) {
      helpers.onProgress({ phase: 'processing', value: (i + 0.5) / files.length, message: `Watermarking ${input.name}` })
      const bitmap = await createImageBitmap(input.file)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      ctx.save()
      ctx.globalAlpha = options.opacity / 100
      ctx.font = `bold ${options.fontSize}px DM Sans, sans-serif`
      ctx.fillStyle = options.color
      const metrics = ctx.measureText(options.text)
      const tw = metrics.width
      const pad = 20
      let x = 0, y = 0
      switch (options.position) {
        case 'center': x = (canvas.width - tw) / 2; y = canvas.height / 2; break
        case 'bottom-right': x = canvas.width - tw - pad; y = canvas.height - pad; break
        case 'bottom-left': x = pad; y = canvas.height - pad; break
        case 'top-right': x = canvas.width - tw - pad; y = options.fontSize + pad; break
        case 'top-left': x = pad; y = options.fontSize + pad; break
      }
      ctx.fillText(options.text, x, y)
      ctx.restore()
      const blob = await canvas.convertToBlob({ type: options.outputFormat, quality: 0.9 })
      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-watermarked${extMap[options.outputFormat]}`, blob, type: options.outputFormat, size: blob.size })
    }
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs,
      preview: { kind: 'image' as const, title: 'Watermark applied', summary: `${files.length} image(s) watermarked.`, objectUrl: URL.createObjectURL(outputs[0].blob), metadata: [{ label: 'Text', value: options.text }, { label: 'Files', value: `${outputs.length}` }] },
    }
  },
}

export default module
