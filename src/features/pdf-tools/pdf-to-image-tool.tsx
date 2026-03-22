import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsSlider, OptionsCheckbox, OptionsInput } from '../../components/workspace/OptionsComponents'

interface PdfToImageOptions {
  format: 'image/jpeg' | 'image/png' | 'image/webp'
  scale: number
  allPages: boolean
  startPage: number
  endPage: number
}

function PdfToImageOptionsComponent({ options, onChange }: ToolOptionsComponentProps<PdfToImageOptions>) {
  return (
    <OptionsSection label="Output">
      <OptionsSelect
        label="Output format"
        value={options.format}
        onChange={(value) => onChange({ ...options, format: value as PdfToImageOptions['format'] })}
        options={[
          { value: 'image/jpeg', label: 'JPEG' },
          { value: 'image/png', label: 'PNG' },
          { value: 'image/webp', label: 'WebP' },
        ]}
      />
      <OptionsSlider
        label="Scale factor (Resolution)"
        value={options.scale}
        min={1}
        max={5}
        step={0.5}
        onChange={(value) => onChange({ ...options, scale: value })}
        displayValue={`${options.scale}x`}
      />
      <OptionsCheckbox
        label="Extract all pages"
        checked={options.allPages}
        onChange={(checked) => onChange({ ...options, allPages: checked })}
      />
      {!options.allPages && (
        <>
          <OptionsInput
            label="Start page"
            type="number"
            value={options.startPage}
            min={1}
            onChange={(value) => onChange({ ...options, startPage: Math.max(1, Number(value)) })}
          />
          <OptionsInput
            label="End page"
            type="number"
            value={options.endPage}
            min={1}
            onChange={(value) => onChange({ ...options, endPage: Math.max(1, Number(value)) })}
          />
        </>
      )}
    </OptionsSection>
  )
}

const extMap: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

const module: ToolModule<PdfToImageOptions> = {
  defaultOptions: { format: 'image/jpeg', scale: 2, allPages: true, startPage: 1, endPage: 1 },
  OptionsComponent: PdfToImageOptionsComponent,
  async run(files, options, helpers) {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
    
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.1, message: `Loading ${input.name}` })
    
    const arrayBuffer = await input.file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    
    const start = options.allPages ? 1 : options.startPage
    const end = options.allPages ? pdf.numPages : Math.min(options.endPage, pdf.numPages)
    if (start > end || start < 1 || start > pdf.numPages) throw new Error(`Invalid page range: ${start}-${end} (Total pages: ${pdf.numPages})`)
    
    const blobs: Array<{ name: string; blob: Blob }> = []
    const totalPages = end - start + 1
    
    for (let pageNum = start; pageNum <= end; pageNum++) {
      helpers.onProgress({ phase: 'processing', value: 0.1 + (0.8 * (pageNum - start + 1)) / totalPages, message: `Rendering page ${pageNum} / ${pdf.numPages}` })
      
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: options.scale })
      const canvas = new OffscreenCanvas(viewport.width, viewport.height)
      const ctx = canvas.getContext('2d')!
      
      if (options.format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport } as any).promise
      
      const blob = await canvas.convertToBlob({ type: options.format, quality: 0.9 })
      blobs.push({ name: `page-${pageNum}${extMap[options.format]}`, blob })
    }
    
    if (blobs.length === 1) {
      const { name, blob } = blobs[0]
      helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
      return {
        outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-${name}`, blob, type: options.format, size: blob.size }],
        preview: { kind: 'image', title: 'PDF page rendered', summary: `Page ${start} rendered locally.`, objectUrl: URL.createObjectURL(blob), metadata: [{ label: 'Format', value: options.format }, { label: 'Resolution', value: `${options.scale}x` }] },
      }
    } else {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      for (const { name, blob } of blobs) zip.file(name, await blob.arrayBuffer())
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
      return {
        outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-images.zip`, blob: zipBlob, type: 'application/zip', size: zipBlob.size }],
        preview: { kind: 'download', title: 'PDF to Images complete', summary: `${blobs.length} pages rendered and bundled into ZIP.`, metadata: [{ label: 'Pages', value: `${start}-${end}` }] },
      }
    }
  },
}

export default module
