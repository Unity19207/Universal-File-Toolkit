import type { InputFile, OutputArtifact } from './types'

export function createInputFile(file: File): InputFile {
  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    objectUrl: file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')
      ? URL.createObjectURL(file)
      : undefined,
  }
}

export function attachObjectUrls(outputs: OutputArtifact[]): OutputArtifact[] {
  return outputs.map((output) => ({
    ...output,
    objectUrl:
      output.type.startsWith('image/') || output.type.startsWith('video/') || output.type.startsWith('audio/') || output.type === 'application/pdf'
        ? URL.createObjectURL(output.blob)
        : undefined,
  }))
}

export function revokeInputFiles(files: InputFile[]) {
  for (const file of files) {
    if (file.objectUrl) URL.revokeObjectURL(file.objectUrl)
  }
}

export function revokeOutputs(outputs: OutputArtifact[]) {
  for (const output of outputs) {
    if (output.objectUrl) URL.revokeObjectURL(output.objectUrl)
  }
}
