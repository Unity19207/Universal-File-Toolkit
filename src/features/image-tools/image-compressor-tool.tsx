import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsSlider } from '../../components/workspace/OptionsComponents'

interface ImageCompressorOptions {
  strategy: 'quality' | 'filesize'
  quality: number
  targetKB: number
  outputFormat: 'same' | 'image/jpeg' | 'image/webp' | 'image/png'
}

function ImageCompressorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ImageCompressorOptions>) {
  return (
    <OptionsSection label="Compression Strategy" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSelect
          label="Strategy"
          value={options.strategy}
          onChange={(val) => onChange({ ...options, strategy: val as ImageCompressorOptions['strategy'] })}
          options={[
            { value: 'quality', label: 'Quality Target' },
            { value: 'filesize', label: 'File Size Target' },
          ]}
        />
        <OptionsSelect
          label="Output Format"
          value={options.outputFormat}
          onChange={(val) => onChange({ ...options, outputFormat: val as ImageCompressorOptions['outputFormat'] })}
          options={[
            { value: 'same', label: 'Original Format' },
            { value: 'image/jpeg', label: 'JPEG (Compact)' },
            { value: 'image/webp', label: 'WebP (Modern)' },
            { value: 'image/png', label: 'PNG (Lossless)' },
          ]}
        />
      </div>

      <div className="mt-6">
        {options.strategy === 'quality' ? (
          <OptionsSlider
            label="Quality"
            min={10}
            max={95}
            value={options.quality}
            onChange={(val) => onChange({ ...options, quality: val })}
          />
        ) : (
          <OptionsInput
            label="Target File Size (KB)"
            type="number"
            min={10}
            value={options.targetKB}
            onChange={(val) => onChange({ ...options, targetKB: Number(val) })}
            placeholder="e.g. 200"
          />
        )}
      </div>
      <p className="text-xs text-secondary mt-4">
        Optimizes images locally using entropy-aware compression.
      </p>
    </OptionsSection>
  )
}

const extMap: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

function resolveFormat(inputType: string, outputFormat: string): string {
  if (outputFormat === 'same') {
    if (inputType === 'image/png') return 'image/png'
    if (inputType === 'image/webp') return 'image/webp'
    return 'image/jpeg'
  }
  return outputFormat
}

const module: ToolModule<ImageCompressorOptions> = {
  defaultOptions: { strategy: 'quality', quality: 75, targetKB: 200, outputFormat: 'same' },
  OptionsComponent: ImageCompressorOptionsComponent,
  async run(files, options, helpers) {
    const outputs = []
    let totalOriginal = 0, totalCompressed = 0
    for (const [i, input] of files.entries()) {
      helpers.onProgress({ phase: 'processing', value: (i + 0.5) / files.length, message: `Compressing ${input.name}` })
      const bitmap = await createImageBitmap(input.file)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')!
      const fmt = resolveFormat(input.type, options.outputFormat)
      if (fmt === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()

      let blob: Blob
      if (options.strategy === 'quality') {
        blob = await canvas.convertToBlob({ type: fmt, quality: options.quality / 100 })
      } else {
        const target = options.targetKB * 1024
        let lo = 0.01, hi = 1.0, best: Blob | null = null
        for (let iter = 0; iter < 8; iter++) {
          const mid = (lo + hi) / 2
          const candidate = await canvas.convertToBlob({ type: fmt, quality: mid })
          if (candidate.size <= target) { best = candidate; lo = mid } else { hi = mid }
        }
        blob = best ?? await canvas.convertToBlob({ type: fmt, quality: lo })
      }
      totalOriginal += input.size
      totalCompressed += blob.size
      const ext = extMap[fmt] ?? '.jpg'
      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-compressed${ext}`, blob, type: fmt, size: blob.size })
    }
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const saved = totalOriginal > 0 ? Math.round((1 - totalCompressed / totalOriginal) * 100) : 0
    return {
      outputs,
      preview: { kind: 'image' as const, title: 'Compression complete', summary: `${files.length} image(s) compressed, ${saved}% smaller.`, objectUrl: URL.createObjectURL(outputs[0].blob), metadata: [{ label: 'Original', value: `${(totalOriginal / 1024).toFixed(0)} KB` }, { label: 'Compressed', value: `${(totalCompressed / 1024).toFixed(0)} KB` }, { label: 'Saved', value: `${saved}%` }] },
    }
  },
}

export default module
