import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface BarcodeGeneratorOptions {
  text: string
  format: 'CODE128' | 'EAN13' | 'UPC' | 'EAN8' | 'ITF14' | 'CODE39'
  width: number
  height: number
  displayValue: boolean
  background: string
  lineColor: string
}

function BarcodeGeneratorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<BarcodeGeneratorOptions>) {
  return (
    <>
      <OptionsSection label="Content">
        <OptionsInput
          label="Barcode Content"
          value={options.text}
          onChange={(val) => onChange({ ...options, text: val })}
          placeholder="Content..."
        />
      </OptionsSection>

      <OptionsSection label="Format & Sizing">
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionsSelect
            label="Barcode Format"
            value={options.format}
            onChange={(val) => onChange({ ...options, format: val as BarcodeGeneratorOptions['format'] })}
            options={[
              { value: 'CODE128', label: 'CODE128 (Most standard)' },
              { value: 'CODE39', label: 'CODE39' },
              { value: 'EAN13', label: 'EAN-13 (13 digits)' },
              { value: 'EAN8', label: 'EAN-8 (8 digits)' },
              { value: 'UPC', label: 'UPC (12 digits)' },
              { value: 'ITF14', label: 'ITF-14 (14 digits)' },
            ]}
          />
          <div className="grid gap-2 grid-cols-2">
            <OptionsInput
              label="Bar Width"
              type="number"
              min={1}
              max={10}
              value={options.width}
              onChange={(val) => onChange({ ...options, width: Number(val) })}
            />
            <OptionsInput
              label="Height"
              type="number"
              min={10}
              max={300}
              value={options.height}
              onChange={(val) => onChange({ ...options, height: Number(val) })}
            />
          </div>
        </div>
      </OptionsSection>

      <OptionsSection label="Style" noBorder>
        <div className="grid gap-4 sm:grid-cols-2 items-end">
          <OptionsCheckbox
            label="Show text below barcode"
            checked={options.displayValue}
            onChange={(val) => onChange({ ...options, displayValue: val })}
          />
          <div className="grid grid-cols-2 gap-2">
            <OptionsInput
              label="Line Color"
              type="color"
              value={options.lineColor}
              onChange={(val) => onChange({ ...options, lineColor: val })}
            />
            <OptionsInput
              label="Background"
              type="color"
              value={options.background}
              onChange={(val) => onChange({ ...options, background: val })}
            />
          </div>
        </div>
      </OptionsSection>
    </>
  )
}

const module: ToolModule<BarcodeGeneratorOptions> = {
  defaultOptions: { text: '123456789012', format: 'CODE128', width: 2, height: 100, displayValue: true, background: '#ffffff', lineColor: '#000000' },
  OptionsComponent: BarcodeGeneratorOptionsComponent,
  async run(_files, options, helpers) {
    if (!options.text.trim()) throw new Error('Please provide content for the barcode.')
    const JsBarcode = (await import('jsbarcode')).default

    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Generating barcode...' })

    // Build SVG string
    const xmlSerializer = new XMLSerializer()
    const documentStr = '<svg xmlns="http://www.w3.org/2000/svg" />'
    const domParser = new DOMParser()
    const doc = domParser.parseFromString(documentStr, 'image/svg+xml')
    const svgNode = doc.querySelector('svg')!

    try {
      JsBarcode(svgNode, options.text, {
        format: options.format,
        width: options.width,
        height: options.height,
        displayValue: options.displayValue,
        background: options.background,
        lineColor: options.lineColor,
        margin: 10,
        xmlDocument: doc
      })
    } catch (e: any) {
      throw new Error(`Failed to generate barcode (this format might require specific length/types like digits only). Details: ${e.message || e}`)
    }

    const svgString = xmlSerializer.serializeToString(svgNode)
    const blob = new Blob([svgString], { type: 'image/svg+xml' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `barcode-${options.format.toLowerCase()}.svg`

    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob, type: 'image/svg+xml', size: blob.size }],
      preview: { 
        kind: 'image', 
        title: 'Barcode Generated', 
        summary: `Generated ${options.format} barcode successfully.`, 
        objectUrl: URL.createObjectURL(blob), 
        metadata: [{ label: 'Format', value: options.format }] 
      },
    }
  },
}

export default module
