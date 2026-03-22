import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface PdfCompressOptions {
  quality: 72 | 150 | 300
  grayscale: boolean
}

function PdfCompressOptionsComponent({ options, onChange }: ToolOptionsComponentProps<PdfCompressOptions>) {
  return (
    <OptionsSection label="Quality">
      <OptionsSelect
        label="Render Quality"
        value={options.quality}
        onChange={(value) => onChange({ ...options, quality: Number(value) as PdfCompressOptions['quality'] })}
        options={[
          { value: 72, label: 'Screen (72 dpi) - Smallest' },
          { value: 150, label: 'Ebook (150 dpi) - Balanced' },
          { value: 300, label: 'Printer (300 dpi) - Highest' },
        ]}
      />
      <OptionsCheckbox
        label="Convert to grayscale (reduces size further)"
        checked={options.grayscale}
        onChange={(checked) => onChange({ ...options, grayscale: checked })}
      />
      <p className="opts-helper">Note: This works by selectively rendering each page to a lossy JPEG structure at your chosen DPI, which shrinks vector blobs significantly.</p>
    </OptionsSection>
  )
}

const module: ToolModule<PdfCompressOptions> = {
  defaultOptions: { quality: 150, grayscale: false },
  OptionsComponent: PdfCompressOptionsComponent,
  async run(files, options, helpers) {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
    
    const { PDFDocument } = await import('pdf-lib')
    
    const input = files[0]
    const arrayBuffer = await input.file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Re-building PDF...' })
    const newPdf = await PDFDocument.create()
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      helpers.onProgress({ phase: 'processing', value: 0.1 + (0.8 * pageNum) / pdf.numPages, message: `Compressing page ${pageNum} / ${pdf.numPages}` })
      
      const page = await pdf.getPage(pageNum)
      const scale = options.quality / 72 // 72 is base resolution
      const viewport = page.getViewport({ scale })
      const canvas = new OffscreenCanvas(viewport.width, viewport.height)
      const ctx = canvas.getContext('2d')!
      
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport } as any).promise
      
      // If grayscale is requested, convert pixels manually
      if (options.grayscale) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const d = imgData.data
        for (let i = 0; i < d.length; i += 4) {
          const luma = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
          d[i] = d[i + 1] = d[i + 2] = luma
        }
        ctx.putImageData(imgData, 0, 0)
      }
      
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
      const jpegBytes = await blob.arrayBuffer()
      const embeddedJpg = await newPdf.embedJpg(jpegBytes)
      const { width, height } = embeddedJpg.scale(1 / scale) // restore original pt dimensions
      
      const newPage = newPdf.addPage([width, height])
      newPage.drawImage(embeddedJpg, { x: 0, y: 0, width, height })
    }
    
    helpers.onProgress({ phase: 'processing', value: 0.95, message: 'Saving compressed PDF...' })
    const pdfBytes = await newPdf.save()
    const finalBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
    
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-compressed.pdf`
    
    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob: finalBlob, type: 'application/pdf', size: finalBlob.size }],
      preview: { kind: 'pdf', title: 'PDF Compressed', summary: `Reduced to ${options.quality} dpi representation.`, metadata: [{ label: 'Compression Ratio', value: `${(100 - (finalBlob.size / input.file.size) * 100).toFixed(1)}% smaller` }] },
    }
  },
}

export default module
