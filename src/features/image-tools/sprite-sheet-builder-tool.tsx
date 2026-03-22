import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsSlider, OptionsCheckbox } from '../../components/workspace/OptionsComponents'

interface SpriteSheetOptions {
  columns: number
  padding: number
  format: 'image/png' | 'image/jpeg'
  generateCss: boolean
}

function SpriteSheetOptionsComponent({ options, onChange }: ToolOptionsComponentProps<SpriteSheetOptions>) {
  return (
    <OptionsSection label="Atlas Layout" noBorder>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionsSlider
          label="Columns"
          min={1}
          max={12}
          step={1}
          value={options.columns}
          onChange={(val) => onChange({ ...options, columns: val })}
        />
        <OptionsSlider
          label="Inter-Sprite Padding (px)"
          min={0}
          max={40}
          step={2}
          value={options.padding}
          onChange={(val) => onChange({ ...options, padding: val })}
        />
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 mt-6 items-center">
        <OptionsSelect
          label="Export Format"
          value={options.format}
          onChange={(val) => onChange({ ...options, format: val as SpriteSheetOptions['format'] })}
          options={[
            { value: 'image/png', label: 'PNG (Alpha Translucent)' },
            { value: 'image/jpeg', label: 'JPEG (High Quality)' },
          ]}
        />
        <OptionsCheckbox
          label="Include CSS Mapping Sheet"
          checked={options.generateCss}
          onChange={(val) => onChange({ ...options, generateCss: val })}
        />
      </div>
      <p className="text-xs text-secondary mt-4">
        Packs multiple assets into a high-density texture atlas. Ideal for web games and UI systems.
      </p>
    </OptionsSection>
  )
}

const module: ToolModule<SpriteSheetOptions> = {
  defaultOptions: { columns: 4, padding: 2, format: 'image/png', generateCss: true },
  OptionsComponent: SpriteSheetOptionsComponent,
  async run(files, options, helpers) {
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Loading all images...' })
    
    // 1. Load all images
    const images: HTMLImageElement[] = []
    for (let i = 0; i < files.length; i++) {
      helpers.onProgress({ phase: 'processing', value: 0.1 + (0.4 * i) / files.length, message: `Decoding ${files[i].name}...` })
      const img = document.createElement('img')
      const url = URL.createObjectURL(files[i].file)
      img.src = url
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })
      images.push(img)
    }

    // 2. Calculate dimensions
    const maxWidth = Math.max(...images.map(i => i.width))
    const maxHeight = Math.max(...images.map(i => i.height))
    const rows = Math.ceil(images.length / options.columns)
    
    const canvasWidth = options.columns * (maxWidth + options.padding) - options.padding
    const canvasHeight = rows * (maxHeight + options.padding) - options.padding
    
    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext('2d')!
    
    if (options.format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    }

    let cssText = '.sprite {\n  display: inline-block;\n  background-image: url("spritesheet' + (options.format === 'image/png' ? '.png' : '.jpg') + '");\n  background-repeat: no-repeat;\n}\n\n'

    // 3. Draw onto sprite sheet
    for (let i = 0; i < images.length; i++) {
       const img = images[i]
       const x = (i % options.columns) * (maxWidth + options.padding)
       const y = Math.floor(i / options.columns) * (maxHeight + options.padding)
       
       ctx.drawImage(img, x, y)
       
       if (options.generateCss) {
         const name = files[i].name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '-')
         cssText += `.sprite-${name} {\n  width: ${img.width}px;\n  height: ${img.height}px;\n  background-position: -${x}px -${y}px;\n}\n\n`
       }
       
       URL.revokeObjectURL(img.src)
    }

    helpers.onProgress({ phase: 'processing', value: 0.8, message: 'Exporting assets...' })

    const spriteBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), options.format, 0.95)
    })
    
    const results: any[] = []
    
    if (options.generateCss) {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      zip.file(`spritesheet${options.format === 'image/png' ? '.png' : '.jpg'}`, await spriteBlob.arrayBuffer())
      zip.file('spritesheet.css', cssText)
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      results.push({ id: crypto.randomUUID(), name: 'spritesheet-bundle.zip', blob: zipBlob, type: 'application/zip', size: zipBlob.size })
    } else {
      results.push({ id: crypto.randomUUID(), name: `spritesheet${options.format === 'image/png' ? '.png' : '.jpg'}`, blob: spriteBlob, type: options.format, size: spriteBlob.size })
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })

    return {
      outputs: results,
      preview: {
        kind: 'image',
        title: 'Sprite Sheet Generated',
        summary: `Packed ${images.length} images into a ${canvasWidth}x${canvasHeight} sheet.`,
        objectUrl: URL.createObjectURL(spriteBlob)
      }
    }
  },
}

export default module
