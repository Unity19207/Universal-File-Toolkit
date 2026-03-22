export interface InputFile {
  id: string
  file: File
  name: string
  size: number
  type: string
  objectUrl?: string
}

export interface FileValidationIssue {
  code: 'type' | 'size' | 'count'
  message: string
}

export interface OutputArtifact {
  id: string
  name: string
  blob: Blob
  type: string
  size: number
  objectUrl?: string
}

export interface PreviewDetails {
  kind: 'image' | 'text' | 'json' | 'pdf' | 'media' | 'download' | 'markdown-tabs'
  title: string
  summary?: string
  objectUrl?: string
  textContent?: string
  copyText?: string
  metadata?: Array<{ label: string; value: string }>
}
