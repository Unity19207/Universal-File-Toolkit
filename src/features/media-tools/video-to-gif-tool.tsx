import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSlider } from '../../components/workspace/OptionsComponents'

interface VideoToGifOptions {
  fps: number
  scale: number
  duration: number
}

function VideoToGifOptionsComponent({ options, onChange }: ToolOptionsComponentProps<VideoToGifOptions>) {
  return (
    <OptionsSection label="GIF Settings">
      <OptionsSlider
        label="GIF Framerate (FPS)"
        value={options.fps}
        min={5}
        max={30}
        onChange={(v) => onChange({ ...options, fps: v })}
      />
      <OptionsSlider
        label="Output Width (px)"
        value={options.scale}
        min={100}
        max={800}
        step={20}
        onChange={(v) => onChange({ ...options, scale: v })}
      />
      <OptionsSlider
        label="Max Duration limit (sec)"
        value={options.duration}
        min={1}
        max={30}
        onChange={(v) => onChange({ ...options, duration: v })}
      />
      <p className="text-xs text-secondary mt-2">GIF generation takes significant memory. Videos are forcefully clamped to your maximum duration to prevent crash limits.</p>
    </OptionsSection>
  )
}

let globalFFmpeg: any = null

const module: ToolModule<VideoToGifOptions> = {
  defaultOptions: { fps: 10, scale: 480, duration: 10 },
  OptionsComponent: VideoToGifOptionsComponent,
  async run(files, options, helpers) {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util')

    if (!globalFFmpeg) {
      helpers.onProgress({ phase: 'processing', value: 0.1, message: 'Loading video engine...' })
      globalFFmpeg = new FFmpeg()
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'
      await globalFFmpeg.load({ coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm') })
    }

    const ffmpeg = globalFFmpeg
    const outputs = []

    for (const [i, input] of files.entries()) {
      const inName = `input_${i}.mp4`
      const outName = `output_${i}.gif`

      await ffmpeg.writeFile(inName, await fetchFile(input.file))
      helpers.onProgress({ phase: 'processing', value: 0.3, message: 'Generating optimal color palette...' })

      // Generate palette
      await ffmpeg.exec(['-t', String(options.duration), '-i', inName, '-vf', `fps=${options.fps},scale=${options.scale}:-1:flags=lanczos,palettegen`, 'palette.png'])

      helpers.onProgress({ phase: 'processing', value: 0.6, message: 'Rendering GIF...' })

      // Render GIF
      await ffmpeg.exec(['-t', String(options.duration), '-i', inName, '-i', 'palette.png', '-filter_complex', `fps=${options.fps},scale=${options.scale}:-1:flags=lanczos[x];[x][1:v]paletteuse`, outName])

      const data = await ffmpeg.readFile(outName)
      const blob = new Blob([((data as Uint8Array).buffer as unknown) as BlobPart], { type: 'image/gif' })

      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}.gif`, blob, type: 'image/gif', size: blob.size })

      await ffmpeg.deleteFile(inName)
      await ffmpeg.deleteFile('palette.png')
      await ffmpeg.deleteFile(outName)
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs,
      preview: { kind: 'image', title: 'Video Converted to GIF', summary: 'Animation generated correctly.', objectUrl: URL.createObjectURL(outputs[0].blob) }
    }
  },
}

export default module
