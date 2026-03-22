import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface ImageCropRotateOptions {
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  rotation: 0 | 90 | 180 | 270
  flipH: boolean
  flipV: boolean
  outputFormat: 'image/jpeg' | 'image/png' | 'image/webp'
}

function ImageCropRotateOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ImageCropRotateOptions>) {
  return (
    <>
      <OptionsSection label="Manual Crop (Pixels)">
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionsInput
            label="X Offset"
            type="number"
            min={0}
            value={options.cropX}
            onChange={(val) => onChange({ ...options, cropX: Number(val) })}
            placeholder="0"
          />
          <OptionsInput
            label="Y Offset"
            type="number"
            min={0}
            value={options.cropY}
            onChange={(val) => onChange({ ...options, cropY: Number(val) })}
            placeholder="0"
          />
          <OptionsInput
            label="Width (0 = Full)"
            type="number"
            min={0}
            value={options.cropWidth}
            onChange={(val) => onChange({ ...options, cropWidth: Number(val) })}
            placeholder="Auto"
          />
          <OptionsInput
            label="Height (0 = Full)"
            type="number"
            min={0}
            value={options.cropHeight}
            onChange={(val) => onChange({ ...options, cropHeight: Number(val) })}
            placeholder="Auto"
          />
        </div>
      </OptionsSection>

      <OptionsSection label="Transform & Format" noBorder>
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionsSelect
            label="Rotation"
            value={options.rotation}
            onChange={(val) => onChange({ ...options, rotation: Number(val) as ImageCropRotateOptions['rotation'] })}
            options={[
              { value: 0, label: '0°' },
              { value: 90, label: '90° Clockwise' },
              { value: 180, label: '180° Flip' },
              { value: 270, label: '90° Counter-Clockwise' },
            ]}
          />
          <OptionsSelect
            label="Output Format"
            value={options.outputFormat}
            onChange={(val) => onChange({ ...options, outputFormat: val as ImageCropRotateOptions['outputFormat'] })}
            options={[
              { value: 'image/jpeg', label: 'JPEG' },
              { value: 'image/png', label: 'PNG' },
              { value: 'image/webp', label: 'WebP' },
            ]}
          />
        </div>
        <div className="flex gap-4 mt-4">
          <OptionsCheckbox
            label="Flip Horizontal"
            checked={options.flipH}
            onChange={(val) => onChange({ ...options, flipH: val })}
          />
          <OptionsCheckbox
            label="Flip Vertical"
            checked={options.flipV}
            onChange={(val) => onChange({ ...options, flipV: val })}
          />
        </div>
        <p className="text-xs text-secondary mt-4">
          Adjust crop area and orientation with precision. Processing happens on your GPU.
        </p>
      </OptionsSection>
    </>
  )
}

const extMap: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

const module: ToolModule<ImageCropRotateOptions> = {
  defaultOptions: { cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0, rotation: 0, flipH: false, flipV: false, outputFormat: 'image/jpeg' },
  OptionsComponent: ImageCropRotateOptionsComponent,
  async run(files, options, helpers) {
    const outputs = []
    for (const [i, input] of files.entries()) {
      helpers.onProgress({ phase: 'processing', value: (i + 0.5) / files.length, message: `Processing ${input.name}` })
      const bitmap = await createImageBitmap(input.file)
      const sx = options.cropX, sy = options.cropY
      const sw = options.cropWidth || bitmap.width - sx
      const sh = options.cropHeight || bitmap.height - sy
      const swapped = options.rotation === 90 || options.rotation === 270
      const cw = swapped ? sh : sw
      const ch = swapped ? sw : sh
      const canvas = new OffscreenCanvas(cw, ch)
      const ctx = canvas.getContext('2d')!
      ctx.translate(cw / 2, ch / 2)
      if (options.rotation) ctx.rotate((options.rotation * Math.PI) / 180)
      ctx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1)
      ctx.drawImage(bitmap, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh)
      bitmap.close()
      const blob = await canvas.convertToBlob({ type: options.outputFormat, quality: 0.9 })
      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-cropped${extMap[options.outputFormat]}`, blob, type: options.outputFormat, size: blob.size })
    }
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs,
      preview: { kind: 'image' as const, title: 'Crop & rotate complete', summary: `Processed ${files.length} image(s).`, objectUrl: URL.createObjectURL(outputs[0].blob), metadata: [{ label: 'Files', value: `${outputs.length}` }] },
    }
  },
}

export default module
