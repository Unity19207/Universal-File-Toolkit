import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput } from '../../components/workspace/OptionsComponents'

interface PdfPageReorderOptions {
  pageOrder: string
  deletePages: string
  duplicatePages: string
}

function PdfPageReorderOptionsComponent({ options, onChange }: ToolOptionsComponentProps<PdfPageReorderOptions>) {
  return (
    <OptionsSection label="Page Operations">
      <OptionsInput label="New page order" value={options.pageOrder} onChange={(value) => onChange({ ...options, pageOrder: value })} placeholder="e.g. 3,1,2 or 1,3,5-8,2 (leave blank to keep original)" />
      <OptionsInput label="Pages to delete" value={options.deletePages} onChange={(value) => onChange({ ...options, deletePages: value })} placeholder="e.g. 2,4" />
      <OptionsInput label="Pages to duplicate" value={options.duplicatePages} onChange={(value) => onChange({ ...options, duplicatePages: value })} placeholder="e.g. 1 (creates a copy right after)" />
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

const module: ToolModule<PdfPageReorderOptions> = {
  defaultOptions: { pageOrder: '', deletePages: '', duplicatePages: '' },
  OptionsComponent: PdfPageReorderOptionsComponent,
  async run(files, options, helpers) {
    const { PDFDocument } = await import('pdf-lib')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Loading PDF...' })
    const pdfDoc = await PDFDocument.load(await input.file.arrayBuffer())
    const totalPages = pdfDoc.getPageCount()
    
    let orderIndices = parseRange(options.pageOrder, totalPages)
    if (orderIndices.length === 0) {
      orderIndices = Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    
    const deleteIndices = new Set(parseRange(options.deletePages, totalPages))
    const duplicateIndices = new Set(parseRange(options.duplicatePages, totalPages))
    
    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Reordering pages...' })
    const newPdf = await PDFDocument.create()
    
    for (const pageNum of orderIndices) {
      if (deleteIndices.has(pageNum)) continue
      
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum - 1])
      newPdf.addPage(copiedPage)
      
      if (duplicateIndices.has(pageNum)) {
        const [dupPage] = await newPdf.copyPages(pdfDoc, [pageNum - 1])
        newPdf.addPage(dupPage)
      }
    }
    
    helpers.onProgress({ phase: 'processing', value: 0.9, message: 'Saving PDF...' })
    const pdfBytes = await newPdf.save()
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
    
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-reordered.pdf`
    
    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob, type: 'application/pdf', size: blob.size }],
      preview: { kind: 'pdf', title: 'PDF Reordered', summary: `Final document has ${newPdf.getPageCount()} pages`, metadata: [{ label: 'Difference', value: newPdf.getPageCount() - totalPages > 0 ? `+${newPdf.getPageCount() - totalPages} pages` : `${newPdf.getPageCount() - totalPages} pages` }] },
    }
  },
}

export default module
