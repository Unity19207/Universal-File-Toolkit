import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsSlider } from '../../components/workspace/OptionsComponents'

interface ImageBgRemoverOptions {
  threshold: number
  background: 'Transparent' | 'White' | 'Black' | 'Custom color'
  bgColor: string
}

function ImageBgRemoverOptionsComponent({ options, onChange }: ToolOptionsComponentProps<ImageBgRemoverOptions>) {
  return (
    <OptionsSection label="Segmentation Settings" noBorder>
      <OptionsSlider
        label="Edge Detection Sensitivity"
        min={0.1}
        max={0.9}
        step={0.05}
        value={options.threshold}
        onChange={(val) => onChange({ ...options, threshold: val })}
      />
      
      <div className="grid gap-4 sm:grid-cols-2 mt-6">
        <OptionsSelect
          label="Background Mask"
          value={options.background}
          onChange={(val) => onChange({ ...options, background: val as ImageBgRemoverOptions['background'] })}
          options={[
            { value: 'Transparent', label: 'Transparent (Alpha)' },
            { value: 'White', label: 'Solid White' },
            { value: 'Black', label: 'Solid Black' },
            { value: 'Custom color', label: 'Custom Hex Color' },
          ]}
        />
        {options.background === 'Custom color' && (
          <OptionsInput
            label="Hex Color"
            type="color"
            value={options.bgColor}
            onChange={(val) => onChange({ ...options, bgColor: val })}
          />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '0px 4px 4px 0px', padding: '10px 14px', marginTop: '20px', fontSize: '11px', color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: 13 }}>AI</span>
        <span>Uses Google MediaPipe SelfieSegmentation. Processes 100% locally on your device.</span>
      </div>
    </OptionsSection>
  )
}

let mpPromise: Promise<any> | null = null

async function getSelfieSegmentation() {
  if (mpPromise) return mpPromise
  
  if (typeof window === 'undefined') throw new Error('Offline AI loaded via CDN requires a DOM environment.')
  
  mpPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js'
    script.onload = () => {
      try {
        // @ts-ignore
        const seg = new window.SelfieSegmentation({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        })
        seg.setOptions({ modelSelection: 1 })
        resolve(seg)
      } catch (e) {
        reject(e)
      }
    }
    script.onerror = () => reject(new Error('Failed to load @mediapipe/selfie_segmentation.'))
    document.head.appendChild(script)
  })
  
  return mpPromise
}

const module: ToolModule<ImageBgRemoverOptions> = {
  defaultOptions: { threshold: 0.5, background: 'Transparent', bgColor: '#ffffff' },
  OptionsComponent: ImageBgRemoverOptionsComponent,
  async run(files, options, helpers) {
    const input = files[0]
    
    helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Warming up MediaPipe AI Core...' })
    const seg = await getSelfieSegmentation()
    
    // We must pass an image element, not a blob, to MediaPipe
    const previewUrl = URL.createObjectURL(input.file)
    const imgElement = document.createElement('img')
    imgElement.src = previewUrl
    
    await new Promise((resolve) => {
      imgElement.onload = resolve
    })
    
    const canvas = new OffscreenCanvas(imgElement.width, imgElement.height)
    const ctx = canvas.getContext('2d')!
    let finalBlob: Blob | null = null
    
    helpers.onProgress({ phase: 'processing', value: 0.4, message: 'Determining depth map coordinates...' })
    
    await new Promise<void>((resolve, reject) => {
      seg.onResults((results: any) => {
        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height)
        
        ctx.globalCompositeOperation = 'source-in'
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
        
        if (options.background !== 'Transparent') {
          ctx.globalCompositeOperation = 'destination-over'
          
          if (options.background === 'White') ctx.fillStyle = '#ffffff'
          else if (options.background === 'Black') ctx.fillStyle = '#000000'
          else ctx.fillStyle = options.bgColor
          
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        
        ctx.restore()
        resolve()
      })
      
      seg.send({ image: imgElement }).catch(reject)
    })
    
    helpers.onProgress({ phase: 'processing', value: 0.9, message: 'Exporting PNG map...' })
    
    finalBlob = await canvas.convertToBlob({ type: 'image/png' })
    if (!finalBlob) throw new Error('Segmentation masked export malfunction')
    
    // cleanup
    URL.revokeObjectURL(previewUrl)
    imgElement.remove()
    
    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    const outName = `${input.name.replace(/\.[^.]+$/, '')}-bg-removed.png`
    
    return {
      outputs: [{ id: crypto.randomUUID(), name: outName, blob: finalBlob, type: 'image/png', size: finalBlob.size }],
      preview: { kind: 'image', title: 'Subject Isolated', summary: 'AI Mask calculated against subjects.', objectUrl: URL.createObjectURL(finalBlob) }
    }
  },
}

export default module
