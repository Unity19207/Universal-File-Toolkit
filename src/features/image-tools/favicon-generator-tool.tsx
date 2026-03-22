import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

const SIZES = [16, 32, 48, 64, 128, 192, 256, 512] as const

interface FaviconGeneratorOptions {
  sizes: number[]
  format: 'zip' | 'individual'
  background: string
}

function FaviconOptionsComponent({ options, onChange }: ToolOptionsComponentProps<FaviconGeneratorOptions>) {
  return (
    <OptionsSection label="Icon Configuration" noBorder>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-muted uppercase tracking-wider mb-3 block">Target Dimensions</label>
          <div className="grid grid-cols-4 gap-2">
            {SIZES.map((size) => (
              <OptionsCheckbox
                key={size}
                label={`${size}px`}
                checked={options.sizes.includes(size)}
                onChange={(checked) => {
                  const next = checked 
                    ? [...options.sizes, size].sort((a, b) => a - b)
                    : options.sizes.filter((s) => s !== size)
                  onChange({ ...options, sizes: next })
                }}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-2">
          <OptionsSelect
            label="Package Format"
            value={options.format}
            onChange={(val) => onChange({ ...options, format: val as FaviconGeneratorOptions['format'] })}
            options={[
              { value: 'zip', label: 'All-in-one ZIP' },
              { value: 'individual', label: 'Individual Files' },
            ]}
          />
          <OptionsInput
            label="Backing Color"
            type="color"
            value={options.background}
            onChange={(val) => onChange({ ...options, background: val })}
          />
        </div>
      </div>
      <p className="text-xs text-secondary mt-4">
        Generates production-ready icons for web, iOS, and Android manifests.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<FaviconGeneratorOptions> = {
  defaultOptions: { sizes: [16, 32, 48, 128, 192, 512], format: 'zip', background: '#00000000' },
  OptionsComponent: FaviconOptionsComponent,
  async run(files, options, helpers) {
    if (options.sizes.length === 0) throw new Error('Select at least one icon size.')
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.1, message: `Generating favicons from ${input.name}` })
    const bitmap = await createImageBitmap(input.file)
    const blobs: Array<{ name: string; blob: Blob }> = []

    for (const [i, size] of options.sizes.entries()) {
      const canvas = new OffscreenCanvas(size, size)
      const ctx = canvas.getContext('2d')!
      if (options.background && options.background !== '#00000000') {
        ctx.fillStyle = options.background
        ctx.fillRect(0, 0, size, size)
      }
      ctx.drawImage(bitmap, 0, 0, size, size)
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      blobs.push({ name: `icon-${size}x${size}.png`, blob })
      helpers.onProgress({ phase: 'processing', value: 0.1 + (0.7 * (i + 1)) / options.sizes.length, message: `Generated ${size}x${size}` })
    }
    bitmap.close()

    if (options.format === 'zip') {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      for (const { name, blob } of blobs) zip.file(name, await blob.arrayBuffer())
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
      return {
        outputs: [{ id: crypto.randomUUID(), name: 'favicons.zip', blob: zipBlob, type: 'application/zip', size: zipBlob.size }],
        preview: { kind: 'download', title: 'Favicons generated', summary: `${blobs.length} sizes bundled into ZIP.`, metadata: [{ label: 'Sizes', value: options.sizes.join(', ') }] },
      }
    } else {
      const outputs = blobs.map(({ name, blob }) => ({ id: crypto.randomUUID(), name, blob, type: 'image/png', size: blob.size }))
      helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
      return {
        outputs,
        preview: { kind: 'image', title: 'Favicons generated', summary: `${blobs.length} icon sizes created.`, objectUrl: URL.createObjectURL(outputs[0].blob), metadata: [{ label: 'Sizes', value: options.sizes.join(', ') }] },
      }
    }
  },
}

export default module
