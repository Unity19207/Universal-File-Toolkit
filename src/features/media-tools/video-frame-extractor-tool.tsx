import type { ToolModule, ToolOptionsComponentProps } from '../../core/plugins/types'
import { OptionsSection, OptionsSelect, OptionsInput, OptionsSlider } from '../../components/workspace/OptionsComponents'

interface VideoFrameExtractorOptions {
  mode: 'Single frame at time' | 'Every N seconds' | 'Every N frames'
  timestamp: string
  interval: number
  maxFrames: number
}

function VideoFrameExtractorOptionsComponent({ options, onChange }: ToolOptionsComponentProps<VideoFrameExtractorOptions>) {
  return (
    <OptionsSection label="Extraction Settings">
      <OptionsSelect
        label="Extraction Mode"
        value={options.mode}
        onChange={(v) => onChange({ ...options, mode: v as VideoFrameExtractorOptions['mode'] })}
        options={[
          { value: 'Single frame at time', label: 'Single Frame by Timestamp' },
          { value: 'Every N seconds', label: 'Batch Every N Seconds' },
        ]}
      />
      {options.mode === 'Single frame at time' && (
        <OptionsInput
          label="Exact Timestamp (HH:MM:SS)"
          value={options.timestamp}
          onChange={(v) => onChange({ ...options, timestamp: v })}
          placeholder="00:00:01"
        />
      )}
      {options.mode === 'Every N seconds' && (
        <>
          <OptionsSlider
            label="Extract every X seconds"
            value={options.interval}
            min={1}
            max={60}
            onChange={(v) => onChange({ ...options, interval: v })}
            displayValue={`${options.interval}s`}
          />
          <OptionsSlider
            label="Max Frames to save"
            value={options.maxFrames}
            min={1}
            max={50}
            onChange={(v) => onChange({ ...options, maxFrames: v })}
          />
        </>
      )}
    </OptionsSection>
  )
}

let globalFFmpeg: any = null

const module: ToolModule<VideoFrameExtractorOptions> = {
  defaultOptions: { mode: 'Single frame at time', timestamp: '00:00:01', interval: 5, maxFrames: 10 },
  OptionsComponent: VideoFrameExtractorOptionsComponent,
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
      const ext = input.name.split('.').pop() || 'mp4'
      const inName = `input_${i}.${ext}`

      await ffmpeg.writeFile(inName, await fetchFile(input.file))

      helpers.onProgress({ phase: 'processing', value: 0.5, message: `Extracting frames from ${input.name}...` })

      if (options.mode === 'Single frame at time') {
        const outName = 'frame.png'
        const args = ['-ss', options.timestamp || '00:00:01', '-i', inName, '-frames:v', '1', outName]
        await ffmpeg.exec(args)
        const data = await ffmpeg.readFile(outName)
        const blob = new Blob([((data as Uint8Array).buffer as unknown) as BlobPart], { type: 'image/png' })
        outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-frame-${options.timestamp.replace(/:/g, '')}.png`, blob, type: 'image/png', size: blob.size })
        await ffmpeg.deleteFile(outName)
      } else {
        const pattern = 'image_%03d.png'
        const args = ['-i', inName, '-vf', `fps=1/${options.interval}`, '-frames:v', String(options.maxFrames), pattern]
        await ffmpeg.exec(args)

        // Bundle all generated PNGs
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()

        // Loop up to maxFrames and track generated files
        let generatedConfig = 0
        for (let j = 1; j <= options.maxFrames; j++) {
          const fn = `image_${String(j).padStart(3, '0')}.png`
          try {
            const data = await ffmpeg.readFile(fn)
            zip.file(fn, data)
            await ffmpeg.deleteFile(fn)
            generatedConfig++
          } catch (e) {
            // File not generated, EOF reached
            break
          }
        }

        if (generatedConfig > 0) {
          const zipBlob = await zip.generateAsync({ type: 'blob' })
          outputs.push({ id: crypto.randomUUID(), name: `${input.name.replace(/\.[^.]+$/, '')}-frames.zip`, blob: zipBlob, type: 'application/zip', size: zipBlob.size })
        }
      }

      await ffmpeg.deleteFile(inName)
    }

    helpers.onProgress({ phase: 'finalizing', value: 1, message: 'Done' })
    if (outputs.length === 0) throw new Error('No frames were able to be extracted.')

    return {
      outputs,
      preview: { kind: 'image', title: 'Frames Extracted', summary: `Successfully dumped visual data into ${outputs[0].type.includes('zip') ? 'ZIP Archive' : 'PNG Picture'}`, objectUrl: outputs[0].type.includes('png') ? URL.createObjectURL(outputs[0].blob) : undefined }
    }
  },
}

export default module
