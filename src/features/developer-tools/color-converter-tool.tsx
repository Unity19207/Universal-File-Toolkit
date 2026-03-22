import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsInput } from '../../components/workspace/OptionsComponents'

interface ColorConverterOptions {
  inputColor: string
}

function ColorConverterOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ColorConverterOptions>) {
  const handleChange = (val: string) => {
    onChange({ ...options, inputColor: val })
  }

  return (
    <OptionsSection label="Color Input">
      <div className="flex gap-4 items-end">
        <div className="w-16">
          <OptionsInput
            label="Picker"
            type="color"
            value={options.inputColor.startsWith('#') && [4, 7, 9].includes(options.inputColor.length) ? options.inputColor.substring(0, 7) : '#000000'}
            onChange={handleChange}
          />
        </div>
        <div className="flex-1">
          <OptionsInput
            label="Color Value"
            value={options.inputColor}
            onChange={handleChange}
            placeholder="e.g. #ff0000, rgb(255, 0, 0), red, hsl(0, 100%, 50%)"
          />
        </div>
      </div>
      <p className="text-xs text-secondary mt-2">
        Enter any valid color format (HEX, RGB, HSL, Keyword) to parse and convert.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<ColorConverterOptions> = {
  defaultOptions: { inputColor: '#2563eb' },
  OptionsComponent: ColorConverterOptionsComponent,
  async run(_files, options, helpers) {
    const colorConvert = await import('color-convert')
    const convert = colorConvert.default
    
    let baseHex = ''
    let rgb: [number, number, number] = [0, 0, 0]
    
    helpers.onProgress({ phase: 'processing', value: 0.5, message: 'Parsing color...' })

    const input = options.inputColor.trim().toLowerCase()
    
    if (input.startsWith('#')) {
      const hex = input.replace('#', '')
      rgb = convert.hex.rgb(hex)
      baseHex = `#${convert.rgb.hex(rgb).toLowerCase()}`
    } else if (input.startsWith('rgb')) {
      const match = input.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (match) {
        rgb = [Number(match[1]), Number(match[2]), Number(match[3])]
        baseHex = `#${convert.rgb.hex(rgb).toLowerCase()}`
      }
    } else if (input.startsWith('hsl')) {
      const match = input.match(/^hsla?\((\d+),\s*([\d.]+)%?,\s*([\d.]+)%?/)
      if (match) {
        rgb = convert.hsl.rgb([Number(match[1]), Number(match[2]), Number(match[3])])
        baseHex = `#${convert.rgb.hex(rgb).toLowerCase()}`
      }
    } else if (convert.keyword.rgb(input as any)) {
      rgb = convert.keyword.rgb(input as any)
      baseHex = `#${convert.rgb.hex(rgb).toLowerCase()}`
    } else {
      throw new Error(`Unrecognized color format: ${options.inputColor}`)
    }

    const hsl = convert.rgb.hsl(rgb)
    const cmyk = convert.rgb.cmyk(rgb)
    const keyword = convert.rgb.keyword(rgb)

    const formats = {
      HEX: baseHex.toUpperCase(),
      RGB: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
      HSL: `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`,
      CMYK: `cmyk(${cmyk[0]}%, ${cmyk[1]}%, ${cmyk[2]}%, ${cmyk[3]}%)`,
      Keyword: keyword || 'N/A'
    }

    const outputString = Object.entries(formats).map(([k, v]) => `${k}:\t${v}`).join('\n')
    const blob = new Blob([outputString], { type: 'text/plain' })

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs: [{ id: crypto.randomUUID(), name: 'color.txt', blob, type: 'text/plain', size: blob.size }],
      preview: { 
        kind: 'text', 
        title: 'Color Converted', 
        summary: 'Color successfully parsed into multiple formats.', 
        textContent: outputString, 
        copyText: outputString,
        metadata: [{ label: 'Preview', value: baseHex.toUpperCase(), color: baseHex }]
      },
      additionalData: { formats, baseHex }
    }
  },
}

export default module
