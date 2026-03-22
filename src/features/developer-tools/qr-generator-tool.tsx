import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsTextArea, OptionsSelect, OptionsSlider, OptionsInput } from '../../components/workspace/OptionsComponents'

interface QrGeneratorOptions {
  text: string
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'
  scale: number
  margin: number
  colorDark: string
  colorLight: string
  format: 'image/png' | 'image/jpeg' | 'image/webp' | 'svg'
}

function QrGeneratorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<QrGeneratorOptions>) {
  return (
    <>
      <OptionsSection label="Payload">
        <OptionsTextArea
          label="QR Content (URL, Text, VCard, etc.)"
          value={options.text}
          onChange={(val) => onChange({ ...options, text: val })}
          placeholder="https://example.com"
          rows={3}
        />
      </OptionsSection>

      <OptionsSection label="Settings">
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionsSelect
            label="Error Correction"
            value={options.errorCorrectionLevel}
            onChange={(val) => onChange({ ...options, errorCorrectionLevel: val as QrGeneratorOptions['errorCorrectionLevel'] })}
            options={[
              { value: 'L', label: 'Low (7%)' },
              { value: 'M', label: 'Medium (15%)' },
              { value: 'Q', label: 'Quartile (25%)' },
              { value: 'H', label: 'High (30%)' },
            ]}
          />
          <OptionsSlider
            label="Size Scale"
            min={2}
            max={20}
            value={options.scale}
            onChange={(val) => onChange({ ...options, scale: val })}
          />
          <OptionsSelect
            label="Output Format"
            value={options.format}
            onChange={(val) => onChange({ ...options, format: val as QrGeneratorOptions['format'] })}
            options={[
              { value: 'image/png', label: 'PNG Image' },
              { value: 'image/jpeg', label: 'JPEG Image' },
              { value: 'image/webp', label: 'WebP Image' },
              { value: 'svg', label: 'Vector SVG' },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <OptionsInput
              label="Foreground"
              type="color"
              value={options.colorDark}
              onChange={(val) => onChange({ ...options, colorDark: val })}
            />
            <OptionsInput
              label="Background"
              type="color"
              value={options.colorLight}
              onChange={(val) => onChange({ ...options, colorLight: val })}
            />
          </div>
        </div>
      </OptionsSection>
    </>
  )
}

const module: ToolModule<QrGeneratorOptions> = {
  defaultOptions: { text: 'https://codex.run', errorCorrectionLevel: 'M', scale: 10, margin: 4, colorDark: '#000000', colorLight: '#ffffff', format: 'image/png' },
  OptionsComponent: QrGeneratorOptionsComponent,
  async run(_files, options, helpers) {
    if (!options.text.trim()) throw new Error('Please provide content for the QR code.')
    const QRCode = (await import('qrcode')).default

    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Generating QR code...' })

    const qrOptions = {
      errorCorrectionLevel: options.errorCorrectionLevel,
      margin: options.margin,
      scale: options.scale,
      color: { dark: options.colorDark + 'ff', light: options.colorLight + 'ff' }
    }

    let blob: Blob
    let mimeType: string = options.format
    let ext = mimeType === 'svg' ? 'svg' : mimeType.split('/')[1]

    if (options.format === 'svg') {
      const svgString = await QRCode.toString(options.text, { ...qrOptions, type: 'svg' })
      blob = new Blob([svgString], { type: 'image/svg+xml' })
      mimeType = 'image/svg+xml'
    } else {
      const dataUrl = await QRCode.toDataURL(options.text, { ...qrOptions, type: options.format })
      const base64 = dataUrl.split(',')[1]
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      blob = new Blob([bytes], { type: mimeType })
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `qrcode.${ext}`

    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob, type: mimeType, size: blob.size }],
      preview: { 
        kind: 'image', 
        title: 'QR Code generated', 
        summary: 'Generated QR code successfully.', 
        objectUrl: URL.createObjectURL(blob), 
        metadata: [{ label: 'Format', value: options.format.toUpperCase() }] 
      },
    }
  },
}

export default module
