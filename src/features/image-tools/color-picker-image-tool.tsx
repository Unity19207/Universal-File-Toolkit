import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsSlider } from '../../components/workspace/OptionsComponents'

interface ColorPickerOptions {
  colorCount: number
  format: 'JSON' | 'CSS Variables' | 'Tailwind config'
}

function ColorPickerOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ColorPickerOptions>) {
  return (
    <OptionsSection label="Analysis Parameters" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSlider
          label={`Palette Limit: ${options.colorCount} colors`}
          min={2}
          max={20}
          step={2}
          value={options.colorCount}
          onChange={(val) => onChange({ ...options, colorCount: val })}
        />
        <OptionsSelect
          label="Export Format"
          value={options.format}
          onChange={(val) => onChange({ ...options, format: val as ColorPickerOptions['format'] })}
          options={[
            { value: 'JSON', label: 'JSON Data Array' },
            { value: 'CSS Variables', label: 'CSS Variables (:root)' },
            { value: 'Tailwind config', label: 'Tailwind Config Module' },
          ]}
        />
      </div>
      <p className="text-xs text-secondary mt-4">
        Extracts dominant HEX codes using k-means pixel clustering. Optimized for quickly building UI color schemes.
      </p>
    </OptionsSection>
  )
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

const module: ToolModule<ColorPickerOptions> = {
  defaultOptions: { colorCount: 8, format: 'JSON' },
  OptionsComponent: ColorPickerOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Loading image...' })
    
    const img = document.createElement('img')
    const url = URL.createObjectURL(input.file)
    img.src = url
    
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    
    helpers.onProgress({ phase: 'processing', value: 0.3, message: 'Downsampling for analysis...' })
    
    // Scale down for faster analysis
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, 100, 100)
    
    const imageData = ctx.getImageData(0, 0, 100, 100).data
    const colors: number[][] = []
    for (let i = 0; i < imageData.length; i += 16) { // skip pixels for speed
      colors.push([imageData[i], imageData[i + 1], imageData[i + 2]])
    }
    
    helpers.onProgress({ phase: 'processing', value: 0.6, message: 'Clustering dominant colors...' })

    // Minimal k-means implementation
    let centroids = colors.slice(0, options.colorCount)
    const iterations = 5
    
    for (let it = 0; it < iterations; it++) {
      const groups: number[][][] = Array.from({ length: options.colorCount }, () => [])
      for (const color of colors) {
        let minDist = Infinity
        let groupIdx = 0
        for (let i = 0; i < centroids.length; i++) {
          const dist = Math.sqrt(
            Math.pow(color[0] - centroids[i][0], 2) +
            Math.pow(color[1] - centroids[i][1], 2) +
            Math.pow(color[2] - centroids[i][2], 2)
          )
          if (dist < minDist) {
            minDist = dist
            groupIdx = i
          }
        }
        groups[groupIdx].push(color)
      }
      
      centroids = groups.map((g, i) => {
        if (g.length === 0) return centroids[i]
        const sum = g.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0])
        return [Math.round(sum[0] / g.length), Math.round(sum[1] / g.length), Math.round(sum[2] / g.length)]
      })
    }
    
    const palette = centroids.map(c => rgbToHex(c[0], c[1], c[2]))
    let resultText = ''
    let mime = 'text/plain'
    
    if (options.format === 'JSON') {
       resultText = JSON.stringify({ palette }, null, 2)
       mime = 'application/json'
    } else if (options.format === 'CSS Variables') {
       resultText = ':root {\n' + palette.map((hex, i) => `  --color-${i + 1}: ${hex};`).join('\n') + '\n}'
    } else {
       resultText = 'module.exports = {\n  colors: {\n' + palette.map((hex, i) => `    primary${i === 0 ? '' : i}: '${hex}',`).join('\n') + '\n  }\n}'
    }
    
    URL.revokeObjectURL(url)
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    
    const outName = `palette-${input.name.replace(/\.[^.]+$/, '')}.${options.format === 'JSON' ? 'json' : options.format === 'CSS Variables' ? 'css' : 'js'}`

    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob: new Blob([resultText], { type: mime }), type: mime, size: resultText.length }],
      preview: {
        kind: 'text',
        title: 'Image Dominant Palette',
        summary: `Extracted ${palette.length} colors from ${input.name}.`,
        textContent: resultText
      }
    }
  },
}

export default module
