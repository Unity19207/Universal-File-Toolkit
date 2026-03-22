import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsSlider, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface ImageToPdfOptions {
  orientation: 'portrait' | 'landscape' | 'auto'
  margin: number
  fitPage: boolean
}

function ImageToPdfOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ImageToPdfOptions>) {
  return (
    <OptionsSection label="Layout">
      <OptionsSelect
        label="PDF orientation"
        value={options.orientation}
        onChange={(value) => onChange({ ...options, orientation: value as ImageToPdfOptions['orientation'] })}
        options={[
          { value: 'auto', label: 'Auto (based on image)' },
          { value: 'portrait', label: 'Portrait' },
          { value: 'landscape', label: 'Landscape' },
        ]}
      />
      <OptionsSlider
        label="Margin"
        value={options.margin}
        min={0}
        max={100}
        onChange={(value) => onChange({ ...options, margin: value })}
        displayValue={`${options.margin}pt`}
      />
      <OptionsCheckbox
        label="Downscale images to fit A4 page size"
        checked={options.fitPage}
        onChange={(checked) => onChange({ ...options, fitPage: checked })}
      />
    </OptionsSection>
  )
}

const module: ToolModule<ImageToPdfOptions> = {
  defaultOptions: { orientation: 'auto', margin: 0, fitPage: true },
  OptionsComponent: ImageToPdfOptionsComponent,
  async run(files, options, helpers) {
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.create()

    for (let i = 0; i < files.length; i++) {
      const input = files[i]
      helpers.onProgress({ phase: 'processing', value: (i / files.length) * 0.9, message: `Processing ${input.name}` })
      
      const buffer = await input.file.arrayBuffer()
      let image
      if (input.type === 'image/jpeg') image = await pdfDoc.embedJpg(buffer)
      else if (input.type === 'image/png') image = await pdfDoc.embedPng(buffer)
      else {
        const bitmap = await createImageBitmap(input.file)
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, bitmap.width, bitmap.height)
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()
        const converted = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 })
        image = await pdfDoc.embedJpg(await converted.arrayBuffer())
      }

      const dims = image.scale(1)
      let pageDims = [dims.width + options.margin * 2, dims.height + options.margin * 2] as [number, number]
      
      if (options.fitPage) {
        const A4 = [595.28, 841.89] // A4 in points
        let isLandscape = dims.width > dims.height
        if (options.orientation === 'portrait') isLandscape = false
        if (options.orientation === 'landscape') isLandscape = true
        
        pageDims = isLandscape ? [A4[1], A4[0]] : [A4[0], A4[1]]
      }

      const page = pdfDoc.addPage(pageDims)
      
      const availableW = pageDims[0] - options.margin * 2
      const availableH = pageDims[1] - options.margin * 2
      const scaleW = availableW / dims.width
      const scaleH = availableH / dims.height
      const scale = Math.min(1, scaleW, scaleH)
      
      const drawW = dims.width * scale
      const drawH = dims.height * scale
      const x = options.margin + (availableW - drawW) / 2
      const y = options.margin + (availableH - drawH) / 2

      page.drawImage(image, { x, y, width: drawW, height: drawH })
    }

    helpers.onProgress({ phase: 'processing', value: 0.95, message: 'Saving PDF...' })
    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    const outName = files.length === 1 ? `${files[0].name.replace(/\.[^.]+$/, '')}.pdf` : 'images-to.pdf'
    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob, type: 'application/pdf', size: blob.size }],
      preview: { kind: 'download', title: 'Images converted to PDF', summary: `${files.length} images bundled into one PDF locally.`, metadata: [{ label: 'Pages', value: `${files.length}` }] },
    }
  },
}

export default module
