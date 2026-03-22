import type { InputFile, OutputArtifact, PreviewDetails } from '../files/types'

export type JobStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'unsupported'

export interface ToolJobResult {
  outputs: OutputArtifact[]
  preview: PreviewDetails
  metadata?: Array<{ label: string; value: string }>
  warnings?: string[]
}

export interface JobProgress {
  phase: 'idle' | 'preparing' | 'loading' | 'processing' | 'finalizing'
  value: number
  message: string
}

export interface ToolJobRecord {
  id: string
  toolId: string
  status: JobStatus
  progress: JobProgress
  result?: ToolJobResult
  error?: string
  warnings: string[]
  startedAt?: number
  finishedAt?: number
}

export interface ToolSession {
  toolId: string
  inputs: InputFile[]
  job: ToolJobRecord
}
