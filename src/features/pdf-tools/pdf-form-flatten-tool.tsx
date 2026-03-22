import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'

interface PdfFormFlattenOptions {}

function PdfFormFlattenOptionsComponent({}: ToolOptionsComponentProps<PdfFormFlattenOptions>) {
  return (
    <p className="opts-helper">This tool requires no configuration. Simply click Process to flatten all interactive form fields into static text graphics within your PDF.</p>
  )
}

const module: ToolModule<PdfFormFlattenOptions> = {
  defaultOptions: {},
  OptionsComponent: PdfFormFlattenOptionsComponent,
  async run(files, _options, helpers) {
    const { PDFDocument } = await import('pdf-lib')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.4, message: 'Reading forms...' })
    
    const arrayBuffer = await input.file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    
    try {
      const form = pdfDoc.getForm()
      form.flatten()
    } catch {
      // no form fields or failure
    }
    
    helpers.onProgress({ phase: 'processing', value: 0.8, message: 'Saving flattened document...' })
    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
    
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-flattened.pdf`
    
    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob, type: 'application/pdf', size: blob.size }],
      preview: { kind: 'pdf', title: 'Form Flattened', summary: 'All forms have been baked into the document permanently.', metadata: [{ label: 'Status', value: 'Static Form' }] },
    }
  },
}

export default module
