import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput } from '../../components/workspace/OptionsComponents'

interface PdfRotateOptions {
  pageTarget: 'All pages' | 'Odd pages' | 'Even pages' | 'Custom range'
  pageRange: string
  rotation: '90° clockwise' | '180°' | '270° clockwise (90° counter)'
}

function PdfRotateOptionsComponent({ options, onChange }: ToolOptionsComponentProps<PdfRotateOptions>) {
  return (
    <OptionsSection label="Rotation">
      <OptionsSelect
        label="Apply to"
        value={options.pageTarget}
        onChange={(value) => onChange({ ...options, pageTarget: value as PdfRotateOptions['pageTarget'] })}
        options={[
          { value: 'All pages', label: 'All pages' },
          { value: 'Odd pages', label: 'Odd pages' },
          { value: 'Even pages', label: 'Even pages' },
          { value: 'Custom range', label: 'Custom range' },
        ]}
      />
      {options.pageTarget === 'Custom range' && (
        <OptionsInput
          label="Custom page range (e.g. 1-3,5)"
          value={options.pageRange}
          onChange={(value) => onChange({ ...options, pageRange: value })}
          placeholder="1-3,5"
        />
      )}
      <OptionsSelect
        label="Rotation angle"
        value={options.rotation}
        onChange={(value) => onChange({ ...options, rotation: value as PdfRotateOptions['rotation'] })}
        options={[
          { value: '90° clockwise', label: '90° clockwise' },
          { value: '180°', label: '180°' },
          { value: '270° clockwise (90° counter)', label: '270° clockwise (90° counter)' },
        ]}
      />
    </OptionsSection>
  )
}

function parseRange(rangeStr: string, maxPages: number): number[] {
  if (!rangeStr.trim()) return []
  const pages: number[] = []
  const parts = rangeStr.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(n => parseInt(n.trim(), 10))
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= maxPages) pages.push(i)
        }
      }
    } else {
      const p = parseInt(trimmed, 10)
      if (!isNaN(p) && p >= 1 && p <= maxPages) pages.push(p)
    }
  }
  return pages
}

const module: ToolModule<PdfRotateOptions> = {
  defaultOptions: { pageTarget: 'All pages', pageRange: '', rotation: '90° clockwise' },
  OptionsComponent: PdfRotateOptionsComponent,
  async run(files, options, helpers) {
    const { PDFDocument, degrees } = await import('pdf-lib')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Loading PDF...' })
    const pdfDoc = await PDFDocument.load(await input.file.arrayBuffer())
    const totalPages = pdfDoc.getPageCount()
    
    let targetPages: number[] = []
    if (options.pageTarget === 'All pages') {
      targetPages = Array.from({ length: totalPages }, (_, i) => i + 1)
    } else if (options.pageTarget === 'Odd pages') {
      targetPages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p % 2 !== 0)
    } else if (options.pageTarget === 'Even pages') {
      targetPages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p % 2 === 0)
    } else {
      targetPages = parseRange(options.pageRange, totalPages)
    }
    
    const rotAmount = options.rotation === '180°' ? 180 : options.rotation === '90° clockwise' ? 90 : 270
    
    helpers.onProgress({ phase: 'processing', value: 0.5, message: `Rotating ${targetPages.length} pages...` })
    
    for (const pageNum of targetPages) {
      const page = pdfDoc.getPage(pageNum - 1)
      const currentAngle = page.getRotation().angle
      page.setRotation(degrees(currentAngle + rotAmount))
    }
    
    helpers.onProgress({ phase: 'processing', value: 0.9, message: 'Saving PDF...' })
    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
    
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    
    return {
      outputs: [{ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-rotated.pdf`, blob, type: 'application/pdf', size: blob.size }],
      preview: { kind: 'pdf', title: 'PDF Rotated', summary: `Rotated ${targetPages.length} pages by ${options.rotation}`, metadata: [{ label: 'Rotated Pages', value: `${targetPages.length}` }] },
    }
  },
}

export default module
