import { useEffect, useState } from 'react'
import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import type { OutputArtifact } from '../../core/files/types'
import { formatBytes } from '../../core/utils/format'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsSlider, OptionsPillGroup } from '../../components/workspace/OptionsComponents'

type ResizeMode = 'contain' | 'cover' | 'stretch'
type ImageOutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export interface ImageResizerOptions {
  width: number
  height: number
  mode: ResizeMode
  quality: number
  format: ImageOutputFormat
  background: string
}

const presetResolutions = [
  { label: '1080p', width: 1920, height: 1080 },
  { label: '1440p', width: 2560, height: 1440 },
  { label: '2K', width: 2048, height: 1080 },
  { label: '4K', width: 3840, height: 2160 },
  { label: '8K', width: 7680, height: 4320 },
  { label: 'Square', width: 1920, height: 1920 },
]

function ImageResizerOptionsComponent({ options, onChange, inputs }: ToolOptionsComponentProps<ImageResizerOptions>) {
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    let active = true

    async function loadSourceSize() {
      const file = inputs?.[0]?.file
      if (!file || !file.type.startsWith('image/')) {
        setSourceSize(null)
        return
      }

      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      if (active) {
        setSourceSize({ width: bitmap.width, height: bitmap.height })
      }
      bitmap.close()
    }

    loadSourceSize().catch(() => setSourceSize(null))
    return () => {
      active = false
    }
  }, [inputs])

  const sourcePixels = sourceSize ? sourceSize.width * sourceSize.height : null
  const targetPixels = options.width * options.height
  const isUpscaling = sourcePixels && targetPixels > sourcePixels

  return (
    <>
      <OptionsSection label="Dimensions">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-secondary font-medium uppercase tracking-wider">Presets</span>
          {sourceSize && (
            <span className="text-[10px] text-muted font-bold">
              SOURCE: {sourceSize.width} × {sourceSize.height}
            </span>
          )}
        </div>
        <OptionsPillGroup
          options={presetResolutions.map(p => ({ value: `${p.width}x${p.height}`, label: p.label }))}
          value={`${options.width}x${options.height}`}
          onChange={(val) => {
            const [w, h] = val.split('x').map(Number)
            onChange({ ...options, width: w, height: h })
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <OptionsInput
            label="Width (px)"
            type="number"
            min={1}
            value={options.width}
            onChange={(val) => onChange({ ...options, width: Number(val) })}
          />
          <OptionsInput
            label="Height (px)"
            type="number"
            min={1}
            value={options.height}
            onChange={(val) => onChange({ ...options, height: Number(val) })}
          />
        </div>
      </OptionsSection>

      <OptionsSection label="Layout & Output">
        <div className="grid gap-4 sm:grid-cols-2">
          <OptionsSelect
            label="Fit Mode"
            value={options.mode}
            onChange={(val) => onChange({ ...options, mode: val as ResizeMode })}
            options={[
              { value: 'contain', label: 'Contain (Fit Inside)' },
              { value: 'cover', label: 'Cover (Fill Area)' },
              { value: 'stretch', label: 'Stretch to Size' },
            ]}
          />
          <OptionsSelect
            label="Output Format"
            value={options.format}
            onChange={(val) => onChange({ ...options, format: val as ImageOutputFormat })}
            options={[
              { value: 'image/jpeg', label: 'JPEG (Compact)' },
              { value: 'image/png', label: 'PNG (Lossless)' },
              { value: 'image/webp', label: 'WebP (Modern)' },
            ]}
          />
        </div>
      </OptionsSection>

      <OptionsSection label="Quality & Processing" noBorder>
        <OptionsSlider
          label={isUpscaling ? 'Upscale Detail' : 'Compression Quality'}
          min={35}
          max={100}
          value={options.quality}
          onChange={(val) => onChange({ ...options, quality: val })}
        />
        <div className="mt-4">
          <OptionsInput
            label="Background Color (for transparency)"
            type="color"
            value={options.background}
            onChange={(val) => onChange({ ...options, background: val })}
          />
        </div>
        <p className="text-xs text-secondary mt-2">
          High-performance, multi-threaded image resizing performed entirely in your browser.
        </p>
      </OptionsSection>
    </>
  )
}

async function decodeImage(file: File) {
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

function calculateTargetDimensions(sourceWidth: number, sourceHeight: number, width: number, height: number, mode: ResizeMode) {
  if (mode === 'stretch') {
    return { drawWidth: width, drawHeight: height, offsetX: 0, offsetY: 0, canvasWidth: width, canvasHeight: height }
  }

  const widthRatio = width / sourceWidth
  const heightRatio = height / sourceHeight
  const scale = mode === 'cover' ? Math.max(widthRatio, heightRatio) : Math.min(widthRatio, heightRatio)
  const drawWidth = Math.round(sourceWidth * scale)
  const drawHeight = Math.round(sourceHeight * scale)

  return {
    drawWidth,
    drawHeight,
    offsetX: Math.round((width - drawWidth) / 2),
    offsetY: Math.round((height - drawHeight) / 2),
    canvasWidth: width,
    canvasHeight: height,
  }
}

async function renderImage(file: File, options: ImageResizerOptions) {
  const image = await decodeImage(file)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    image.close()
    throw new Error('Canvas is not available in this browser.')
  }

  const sizing = calculateTargetDimensions(image.width, image.height, options.width, options.height, options.mode)
  canvas.width = sizing.canvasWidth
  canvas.height = sizing.canvasHeight

  if (options.format !== 'image/png') {
    context.fillStyle = options.background
    context.fillRect(0, 0, canvas.width, canvas.height)
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height)
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, sizing.offsetX, sizing.offsetY, sizing.drawWidth, sizing.drawHeight)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result)
        else reject(new Error('Image encoding failed.'))
      },
      options.format,
      options.quality / 100,
    )
  })

  image.close()
  return { blob, sizing }
}

function extensionForType(type: ImageOutputFormat) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

const module: ToolModule<ImageResizerOptions> = {
  defaultOptions: {
    width: 1600,
    height: 900,
    mode: 'contain',
    quality: 82,
    format: 'image/jpeg',
    background: '#ffffff',
  },
  OptionsComponent: ImageResizerOptionsComponent,
  async run(files, options, helpers) {
    const outputs: OutputArtifact[] = []

    for (const [index, item] of files.entries()) {
      helpers.onProgress({
        phase: 'processing',
        value: (index + 0.1) / files.length,
        message: `Rendering ${item.name}`,
      })

      const { blob, sizing } = await renderImage(item.file, options)
      const stem = item.name.replace(/\.[^.]+$/, '')
      outputs.push({
        id: crypto.randomUUID(),
        name: `${stem}-${options.width}x${options.height}.${extensionForType(options.format)}`,
        blob,
        type: options.format,
        size: blob.size,
      })

      helpers.onProgress({
        phase: 'processing',
        value: (index + 1) / files.length,
        message: `Finished ${item.name}`,
      })

      if (helpers.signal.aborted) throw new Error('Image conversion canceled.')

      if (index === files.length - 1) {
        const sizeDelta = outputs[0].size - files[0].size
        return {
          outputs,
          preview: {
            kind: 'image',
            title: 'Image transform complete',
            summary: `${files.length} image${files.length > 1 ? 's' : ''} processed locally.`,
            metadata: [
              { label: 'Canvas size', value: `${sizing.canvasWidth} x ${sizing.canvasHeight}` },
              { label: 'Output format', value: options.format.replace('image/', '').toUpperCase() },
              { label: 'Quality', value: `${options.quality}%` },
              {
                label: sizeDelta <= 0 ? 'Space saved' : 'Size increase',
                value: formatBytes(Math.abs(sizeDelta)),
              },
            ],
          },
        }
      }
    }

    throw new Error('No image output was produced.')
  },
}

export default module
