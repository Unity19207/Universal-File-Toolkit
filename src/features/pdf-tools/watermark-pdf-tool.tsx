import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput, OptionsSlider } from '../../components/workspace/OptionsComponents'

interface WatermarkPdfOptions {
  text: string
  opacity: number
  color: string
  size: number
  rotation: number
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace('#', '')
  return {
    r: parseInt(c.substring(0, 2), 16) / 255,
    g: parseInt(c.substring(2, 4), 16) / 255,
    b: parseInt(c.substring(4, 6), 16) / 255,
  }
}

function WatermarkPdfOptionsComponent({ options, onChange }: ToolOptionsComponentProps<WatermarkPdfOptions>) {
  return (
    <OptionsSection label="Watermark">
      <OptionsInput
        label="Watermark text"
        value={options.text}
        onChange={(value) => onChange({ ...options, text: value })}
        placeholder="CONFIDENTIAL"
      />
      <OptionsSlider
        label="Opacity"
        value={options.opacity}
        min={5}
        max={100}
        onChange={(value) => onChange({ ...options, opacity: value })}
        displayValue={`${options.opacity}%`}
      />
      <OptionsSlider
        label="Font size"
        value={options.size}
        min={12}
        max={144}
        onChange={(value) => onChange({ ...options, size: value })}
        displayValue={`${options.size}pt`}
      />
      <OptionsSlider
        label="Rotation"
        value={options.rotation}
        min={-90}
        max={90}
        onChange={(value) => onChange({ ...options, rotation: value })}
        displayValue={`${options.rotation}°`}
      />
      <div className="opts-field">
        <label className="opts-label">Color</label>
        <input type="color" value={options.color} onChange={(e) => onChange({ ...options, color: e.target.value })} className="h-10 w-full rounded-2xl border border-stone-300" />
      </div>
    </OptionsSection>
  )
}

const module: ToolModule<WatermarkPdfOptions> = {
  defaultOptions: { text: 'CONFIDENTIAL', opacity: 30, color: '#ff0000', size: 60, rotation: 45 },
  OptionsComponent: WatermarkPdfOptionsComponent,
  async run(files, options, helpers) {
    if (!options.text.trim()) throw new Error('Watermark text cannot be empty.')
    const { PDFDocument, rgb, degrees } = await import('pdf-lib')
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.3, message: `Watermarking ${input.name}` })

    const buffer = await input.file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(buffer)
    const pages = pdfDoc.getPages()
    const { r, g, b } = hexToRgb(options.color)
    const color = rgb(r, g, b)

    for (let i = 0; i < pages.length; i++) {
      helpers.onProgress({ phase: 'processing', value: 0.3 + (0.6 * (i + 1)) / pages.length, message: `Watermarking page ${i + 1} / ${pages.length}` })
      const page = pages[i]
      const { width, height } = page.getSize()
      page.drawText(options.text, {
        x: width / 2,
        y: height / 2,
        size: options.size,
        color,
        opacity: options.opacity / 100,
        rotate: degrees(options.rotation),
      })
    }

    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-watermarked.pdf`, blob, type: 'application/pdf', size: blob.size }],
      preview: { kind: 'download', title: 'PDF watermarked', summary: `${pages.length} pages modified locally.`, metadata: [{ label: 'Watermark', value: options.text }] },
    }
  },
}

export default module
