import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface ExifViewerOptions {
  stripMetadata: boolean
}

function ExifViewerOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ExifViewerOptions>) {
  return (
    <OptionsSection label="Metadata Options">
      <OptionsCheckbox
        label="Strip metadata for privacy (Download cleaned file)"
        checked={options.stripMetadata}
        onChange={(v) => onChange({ ...options, stripMetadata: v })}
      />
      <p className="text-xs text-secondary mt-2">View all EXIF, IPTC, and XMP metadata natively in the browser without any data leaving your device.</p>
    </OptionsSection>
  )
}

const module: ToolModule<ExifViewerOptions> = {
  defaultOptions: { stripMetadata: false },
  OptionsComponent: ExifViewerOptionsComponent,
  async run(files, options, helpers) {
    const exifr = await import('exifr')
    const input = files[0]

    helpers.onProgress({ phase: 'processing', value: 0.2, message: 'Parsing metadata tags...' })

    // Parse all metadata
    const metadata = await exifr.parse(input.file, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: true,
      icc: true,
      jfif: true
    })

    if (!metadata) {
      if (!options.stripMetadata) throw new Error('No metadata found in this image file.')
    }

    const metadataStr = JSON.stringify(metadata || {}, null, 2)
    const metadataBlob = new Blob([metadataStr], { type: 'application/json' })

    const results: any[] = [{
      id: crypto.randomUUID(),
      name: `${input.name.replace(/\.[^.]+$/, '')}-metadata.json`,
      blob: metadataBlob,
      type: 'application/json',
      size: metadataBlob.size
    }]

    let previewContent = metadataStr
    let previewTitle = 'Metadata Results'

    if (options.stripMetadata) {
      helpers.onProgress({ phase: 'processing', value: 0.6, message: 'Re-encoding image to strip tags...' })

      const img = document.createElement('img')
      const url = URL.createObjectURL(input.file)
      img.src = url

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const cleanBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), input.file.type || 'image/jpeg', 0.95)
      })

      URL.revokeObjectURL(url)

      const cleanName = `clean-${input.name}`
      results.push({
        id: crypto.randomUUID(),
        name: cleanName,
        blob: cleanBlob,
        type: cleanBlob.type,
        size: cleanBlob.size
      })

      previewTitle = 'Metadata Stripped Successfully'
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    return {
      outputs: results,
      preview: {
        kind: 'text',
        title: previewTitle,
        summary: `Extracted ${Object.keys(metadata || {}).length} metadata fields.`,
        textContent: previewContent
      }
    }
  },
}

export default module
