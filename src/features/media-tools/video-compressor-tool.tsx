import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect } from '../../components/workspace/OptionsComponents'

interface VideoCompressorOptions {
  crf: number
  scale: string
  fps: string
}

function VideoCompressorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<VideoCompressorOptions>) {
  return (
    <OptionsSection label="Compression Settings">
      <OptionsSelect
        label="Compression Level (CRF)"
        value={options.crf}
        onChange={(v) => onChange({ ...options, crf: Number(v) })}
        options={[
          { value: 18, label: 'High Quality (CRF 18) - Large' },
          { value: 23, label: 'Balanced (CRF 23) - Default' },
          { value: 28, label: 'Low Quality (CRF 28) - Small' },
          { value: 35, label: 'Very Low (CRF 35) - Tiny' },
        ]}
      />
      <OptionsSelect
        label="Resolution"
        value={options.scale}
        onChange={(v) => onChange({ ...options, scale: v })}
        options={[
          { value: 'original', label: 'Original' },
          { value: '1920', label: '1080p (FHD)' },
          { value: '1280', label: '720p (HD)' },
          { value: '854', label: '480p (SD)' },
        ]}
      />
      <OptionsSelect
        label="Framerate (FPS)"
        value={options.fps}
        onChange={(v) => onChange({ ...options, fps: v })}
        options={[
          { value: 'original', label: 'Original' },
          { value: '30', label: '30 fps' },
          { value: '24', label: '24 fps (Cinematic)' },
          { value: '15', label: '15 fps (Choppy/Web)' },
        ]}
      />
    </OptionsSection>
  )
}

let globalFFmpeg: any = null

const module: ToolModule<VideoCompressorOptions> = {
  defaultOptions: { crf: 28, scale: ' original', fps: 'original' },
  OptionsComponent: VideoCompressorOptionsComponent,
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
      const outName = `output_${i}.mp4`

      await ffmpeg.writeFile(inName, await fetchFile(input.file))

      const args = ['-i', inName, '-c:v', 'libx264', '-crf', String(options.crf), '-preset', 'ultrafast']

      let vf = ''
      if (options.scale !== 'original' && options.scale.trim() !== 'original') {
        vf += `scale=-2:${options.scale === '1920' ? 1080 : options.scale === '1280' ? 720 : 480}`
      }
      if (options.fps !== 'original') {
        if (vf) vf += ','
        vf += `fps=${options.fps}`
      }
      if (vf) args.push('-vf', vf)

      args.push('-c:a', 'aac', '-b:a', '96k', outName)

      ffmpeg.on('progress', ({ progress }: any) => {
         helpers.onProgress({ phase: 'processing', value: progress, message: `Compressing ${input.name} (${Math.round(progress * 100)}%)` })
      })

      await ffmpeg.exec(args)

      const data = await ffmpeg.readFile(outName)
      const blob = new Blob([((data as Uint8Array).buffer as unknown) as BlobPart], { type: 'video/mp4' })

      outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-compressed.mp4`, blob, type: 'video/mp4', size: blob.size })

      ffmpeg.off('progress', () => {})
      await ffmpeg.deleteFile(inName)
      await ffmpeg.deleteFile(outName)
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    return {
      outputs,
      preview: { kind: 'media', title: 'Video Compressed', summary: 'Size severely reduced via CRF and scale logic.', objectUrl: URL.createObjectURL(outputs[0].blob) }
    }
  },
}

export default module
