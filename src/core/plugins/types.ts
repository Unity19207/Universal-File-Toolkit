import type { ComponentType } from 'react'
import type { InputFile } from '../files/types'
import type { JobProgress, ToolJobResult } from '../jobs/types'

export type ToolCategory = 'image' | 'pdf' | 'data' | 'text' | 'media' | 'developer' | 'archive'

export interface ToolCapability {
  supported: boolean
  reason?: string
}

export interface ToolRuntimeHelpers {
  signal: AbortSignal
  onProgress: (progress: Partial<JobProgress> & Pick<JobProgress, 'message'>) => void
}

export interface ToolOptionsComponentProps<TOptions> {
  options: TOptions
  onChange: (next: TOptions) => void
  inputs?: InputFile[]
}

export interface ToolModule<TOptions = any> {
  defaultOptions: TOptions
  OptionsComponent: ComponentType<ToolOptionsComponentProps<TOptions>>
  run: (files: InputFile[], options: TOptions, helpers: ToolRuntimeHelpers) => Promise<ToolJobResult>
}

export interface ToolPlugin {
  id: string
  name: string
  category: ToolCategory
  description: string
  badge: string
  accepts: string[]
  maxFileSize: number
  supportsBatch: boolean
  supportsPaste?: boolean
  featured?: boolean
  requiresFile?: boolean
  load: () => Promise<ToolModule<any>>
  capabilities: () => ToolCapability
}
