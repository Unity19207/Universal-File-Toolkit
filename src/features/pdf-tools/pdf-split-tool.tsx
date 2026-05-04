import { PDFDocument } from 'pdf-lib'
import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput } from '../../components/workspace/OptionsComponents'

interface PdfSplitOptions {
  mode: 'range' | 'per-page'
  ranges: string
}

function parseRanges(value: string, totalPages: number) {
  const pages = new Set<number>()
  for (const segment of value.split(',').map((part) => part.trim()).filter(Boolean)) {
    const [startText, endText] = segment.split('-')
    const start = Number(startText)
    const end = endText ? Number(endText) : start
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end > totalPages || start > end) {
      throw new Error(`Invalid range: ${segment}`)
    }
    for (let page = start; page <= end; page += 1) {
      pages.add(page - 1)
    }
  }
  return Array.from(pages).sort((a, b) => a - b)
}

function PdfSplitOptionsComponent({ options, onChange }: ToolOptionsComponentProps<PdfSplitOptions>) {
  return (
    <OptionsSection label="Split">
      <OptionsSelect
        label="Split mode"
        value={options.mode}
        onChange={(value) => onChange({ ...options, mode: value as PdfSplitOptions['mode'] })}
        options={[
          { value: 'range', label: 'Page ranges' },
          { value: 'per-page', label: 'One PDF per page' },
        ]}
      />
      <OptionsInput
        label="Ranges"
        value={options.ranges}
        disabled={options.mode === 'per-page'}
        onChange={(value) => onChange({ ...options, ranges: value })}
        placeholder="1-3, 5"
      />
    </OptionsSection>
  )
}

const module: ToolModule<PdfSplitOptions> = {
  defaultOptions: {
    mode: 'range',
    ranges: '1',
  },
  OptionsComponent: PdfSplitOptionsComponent,
  async run(files, options, helpers) {
    const source = await PDFDocument.load(await files[0].file.arrayBuffer())
    const totalPages = source.getPageCount()
    const outputs = []

    if (options.mode === 'per-page') {
      if (totalPages > 100) {
        throw new Error(`This PDF has ${totalPages} pages. Per-page split is limited to 100 pages to prevent memory exhaustion. Use page ranges instead.`)
      }
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        const doc = await PDFDocument.create()
        const [page] = await doc.copyPages(source, [pageIndex])
        doc.addPage(page)
        const bytes = await doc.save()
        const blob = new Blob([bytes], { type: 'application/pdf' })
        outputs.push({
          id: crypto.randomUUID(),
          name: `${files[0].name.replace(/\.pdf$/i, '')}-page-${pageIndex + 1}.pdf`,
          blob,
          type: 'application/pdf',
          size: blob.size,
        })
        helpers.onProgress({
          phase: 'processing',
          value: (pageIndex + 1) / totalPages,
          message: `Split page ${pageIndex + 1} of ${totalPages}`,
        })
      }
    } else {
      const pageIndexes = parseRanges(options.ranges, totalPages)
      const doc = await PDFDocument.create()
      const copiedPages = await doc.copyPages(source, pageIndexes)
      copiedPages.forEach((page) => doc.addPage(page))
      const bytes = await doc.save()
      const blob = new Blob([bytes], { type: 'application/pdf' })
      outputs.push({
        id: crypto.randomUUID(),
        name: `${files[0].name.replace(/\.pdf$/i, '')}-split.pdf`,
        blob,
        type: 'application/pdf',
        size: blob.size,
      })
      helpers.onProgress({ phase: 'processing', value: 1, message: 'Extracted requested page range' })
    }

    return {
      outputs,
      preview: {
        kind: 'pdf',
        title: 'Split PDF ready',
        summary: `${outputs.length} PDF output${outputs.length > 1 ? 's' : ''} generated locally.`,
        metadata: [
          { label: 'Original pages', value: `${totalPages}` },
          { label: 'Outputs', value: `${outputs.length}` },
        ],
      },
    }
  },
}

export default module
