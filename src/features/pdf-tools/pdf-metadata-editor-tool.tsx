import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface PdfMetadataOptions {
  title: string
  author: string
  subject: string
  keywords: string
  creator: string
  clearDates: boolean
}

function PdfMetadataOptionsComponent({ options, onChange }: ToolOptionsComponentProps<PdfMetadataOptions>) {
  return (
    <OptionsSection label="Metadata">
      <OptionsInput label="Title" value={options.title} onChange={(value) => onChange({ ...options, title: value })} placeholder="Document title..." />
      <OptionsInput label="Author" value={options.author} onChange={(value) => onChange({ ...options, author: value })} />
      <OptionsInput label="Subject" value={options.subject} onChange={(value) => onChange({ ...options, subject: value })} />
      <OptionsInput label="Keywords (comma-separated)" value={options.keywords} onChange={(value) => onChange({ ...options, keywords: value })} placeholder="e.g. invoice, report, 2024" />
      <OptionsInput label="Creator application" value={options.creator} onChange={(value) => onChange({ ...options, creator: value })} />
      <OptionsCheckbox
        label="Strip creation and modification dates"
        checked={options.clearDates}
        onChange={(checked) => onChange({ ...options, clearDates: checked })}
      />
    </OptionsSection>
  )
}

const module: ToolModule<PdfMetadataOptions> = {
  defaultOptions: { title: '', author: '', subject: '', keywords: '', creator: '', clearDates: false },
  OptionsComponent: PdfMetadataOptionsComponent,
  async run(files, options, helpers) {
    const { PDFDocument } = await import('pdf-lib')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Loading PDF...' })
    const pdfDoc = await PDFDocument.load(await input.file.arrayBuffer())
    
    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Writing metadata...' })
    
    if (options.title) pdfDoc.setTitle(options.title)
    if (options.author) pdfDoc.setAuthor(options.author)
    if (options.subject) pdfDoc.setSubject(options.subject)
    if (options.creator) pdfDoc.setCreator(options.creator)
    
    if (options.keywords) {
      pdfDoc.setKeywords(options.keywords.split(',').map(k => k.trim()).filter(Boolean))
    }
    
    if (options.clearDates) {
      const emptyDate = new Date(0)
      pdfDoc.setCreationDate(emptyDate)
      pdfDoc.setModificationDate(emptyDate)
    } else {
      pdfDoc.setModificationDate(new Date()) // Always touch mod date slightly
    }
    
    helpers.onProgress({ phase: 'processing', value: 0.9, message: 'Saving PDF...' })
    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
    
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-meta.pdf`
    
    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob, type: 'application/pdf', size: blob.size }],
      preview: { kind: 'pdf', title: 'PDF Metadata Updated', summary: 'Metadata properties have been updated.', metadata: [{ label: 'Title', value: options.title || 'None' }, { label: 'Author', value: options.author || 'None' }] },
    }
  },
}

export default module
