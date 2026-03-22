/// <reference lib="webworker" />

import { FFmpeg } from '@ffmpeg/ffmpeg'
import classWorkerURL from '@ffmpeg/ffmpeg/worker?url'

type LoadMessage = { type: 'load' }
type ExtractMessage = { type: 'extract-audio'; payload: { fileName: string; bytes: ArrayBuffer; bitrate: string } }
type IncomingMessage = LoadMessage | ExtractMessage

const ffmpeg = new FFmpeg()
let loaded = false
const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope
const coreURL = new URL('/vendor/ffmpeg/ffmpeg-core.js', workerScope.location.origin).toString()
const wasmURL = new URL('/vendor/ffmpeg/ffmpeg-core.wasm', workerScope.location.origin).toString()

ffmpeg.on('progress', ({ progress }) => {
  workerScope.postMessage({
    type: 'progress',
    payload: {
      value: progress,
      message: 'FFmpeg processing media',
    },
  })
})

workerScope.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  try {
    if (event.data.type === 'load') {
      if (!loaded) {
        workerScope.postMessage({
          type: 'progress',
          payload: {
            value: 0.15,
            message: 'Loading FFmpeg core',
          },
        })
        await ffmpeg.load({ coreURL, wasmURL, classWorkerURL })
        loaded = true
      }
      workerScope.postMessage({ type: 'loaded' })
      return
    }

    if (!loaded) {
      await ffmpeg.load({ coreURL, wasmURL, classWorkerURL })
      loaded = true
    }

    const inputName = event.data.payload.fileName
    const outputName = inputName.replace(/\.[^.]+$/, '') + '.mp3'
    await ffmpeg.writeFile(inputName, new Uint8Array(event.data.payload.bytes))
    await ffmpeg.exec(['-i', inputName, '-vn', '-b:a', event.data.payload.bitrate, outputName])
    const data = await ffmpeg.readFile(outputName)
    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)

    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
    workerScope.postMessage(
      {
        type: 'result',
        payload: {
          fileName: outputName,
          bytes: bytes.buffer,
        },
      },
      [bytes.buffer],
    )
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : 'Media conversion failed.',
      },
    })
  }
}
