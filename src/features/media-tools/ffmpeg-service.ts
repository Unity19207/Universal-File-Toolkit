let worker: Worker | null = null
let loadPromise: Promise<void> | null = null

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../../workers/ffmpeg.worker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

export async function ensureFfmpegLoaded(onProgress: (value: number, message: string) => void) {
  if (loadPromise) return loadPromise
  const ffmpegWorker = getWorker()
  loadPromise = new Promise<void>((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'progress') onProgress(event.data.payload.value, event.data.payload.message)
      if (event.data.type === 'loaded') {
        ffmpegWorker.removeEventListener('message', handleMessage)
        resolve()
      }
      if (event.data.type === 'error') {
        ffmpegWorker.removeEventListener('message', handleMessage)
        reject(new Error(event.data.payload.message))
      }
    }
    ffmpegWorker.addEventListener('message', handleMessage)
    ffmpegWorker.postMessage({ type: 'load' })
  })
  return loadPromise
}

export async function extractMp3(file: File, bitrate: string, onProgress: (value: number, message: string) => void) {
  await ensureFfmpegLoaded(onProgress)
  const ffmpegWorker = getWorker()
  const bytes = await file.arrayBuffer()

  return new Promise<{ fileName: string; blob: Blob }>((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'progress') onProgress(Math.max(event.data.payload.value, 0.2), event.data.payload.message)
      if (event.data.type === 'result') {
        ffmpegWorker.removeEventListener('message', handleMessage)
        resolve({
          fileName: event.data.payload.fileName,
          blob: new Blob([event.data.payload.bytes], { type: 'audio/mpeg' }),
        })
      }
      if (event.data.type === 'error') {
        ffmpegWorker.removeEventListener('message', handleMessage)
        reject(new Error(event.data.payload.message))
      }
    }
    ffmpegWorker.addEventListener('message', handleMessage)
    ffmpegWorker.postMessage({ type: 'extract-audio', payload: { fileName: file.name, bytes, bitrate } }, [bytes])
  })
}
