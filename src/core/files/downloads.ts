import type { OutputArtifact } from './types'

export function downloadArtifact(artifact: OutputArtifact) {
  const url = artifact.objectUrl ?? URL.createObjectURL(artifact.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = artifact.name
  document.body.appendChild(link)
  link.click()
  link.remove()

  if (!artifact.objectUrl) {
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
