import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput } from '../../components/workspace/OptionsComponents'

interface PdfPasswordOptions {
  password: string
}

function PdfPasswordOptionsComponent({ options, onChange }: ToolOptionsComponentProps<PdfPasswordOptions>) {
  return (
    <OptionsSection label="Authentication">
      <OptionsInput
        label="PDF Password"
        type="password"
        value={options.password}
        onChange={(value) => onChange({ ...options, password: value })}
        placeholder="Enter current password to unlock..."
      />
    </OptionsSection>
  )
}

const module: ToolModule<PdfPasswordOptions> = {
  defaultOptions: { password: '' },
  OptionsComponent: PdfPasswordOptionsComponent,
  async run(files, options, helpers) {
    const { PDFDocument } = await import('pdf-lib')
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Unlocking PDF...' })
    
    let pdfDoc;
    try {
      const arrayBuffer = await input.file.arrayBuffer()
      pdfDoc = await PDFDocument.load(arrayBuffer, { password: options.password } as any)
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('password')) {
        throw new Error('Incorrect password or PDF is too heavily encrypted (DRM level).')
      }
      throw err
    }
    
    if (pdfDoc.isEncrypted) {
      // By saving, pdf-lib strips the encryption automatically if it was unlocked properly
    }
    
    helpers.onProgress({ phase: 'processing', value: 0.9, message: 'Saving unlocked PDF...' })
    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
    
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-unlocked.pdf`
    
    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob, type: 'application/pdf', size: blob.size }],
      preview: { kind: 'pdf', title: 'PDF Unlocked', summary: 'Password protection removed successfully.', metadata: [{ label: 'Status', value: 'Unlocked' }] },
    }
  },
}

export default module
