import { PDFDocument } from 'pdf-lib'
import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput } from '../../components/workspace/OptionsComponents'

interface PdfMergeOptions {
  fileName: string
}

function PdfMergeOptionsComponent({ options, onChange }: ToolOptionsComponentProps<PdfMergeOptions>) {
  return (
    <OptionsSection label="Output">
      <OptionsInput
        label="File name"
        value={options.fileName}
        onChange={(value) => onChange({ fileName: value })}
      />
    </OptionsSection>
  )
}

const module: ToolModule<PdfMergeOptions> = {
  defaultOptions: {
    fileName: 'merged-document.pdf',
  },
  OptionsComponent: PdfMergeOptionsComponent,
  async run(files, options, helpers) {
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Merging PDF files' })
    const merged = await PDFDocument.create()
    let totalPages = 0

    for (const [index, file] of files.entries()) {
      const source = await PDFDocument.load(await file.file.arrayBuffer())
      const pages = await merged.copyPages(source, source.getPageIndices())
      pages.forEach((page) => merged.addPage(page))
      totalPages += pages.length
      helpers.onProgress({
        phase: 'processing',
        value: (index + 1) / files.length,
        message: `Added ${file.name}`,
      })
    }

    const bytes = await merged.save()
    const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })
    return {
      outputs: [
        {
          id: crypto.randomUUID(),
          name: options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`,
          blob,
          type: 'application/pdf',
          size: blob.size,
        },
      ],
      preview: {
        kind: 'pdf',
        title: 'Merged PDF ready',
        summary: `${files.length} documents merged into one local output.`,
        metadata: [
          { label: 'Source files', value: `${files.length}` },
          { label: 'Total pages', value: `${totalPages}` },
        ],
      },
    }
  },
}

export default module
