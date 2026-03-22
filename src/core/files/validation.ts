import type { ToolPlugin } from '../plugins/types'
import { formatBytes } from '../utils/format'
import type { FileValidationIssue } from './types'

export function validateFiles(files: File[], plugin: ToolPlugin): FileValidationIssue[] {
  const issues: FileValidationIssue[] = []

  if (!plugin.supportsBatch && files.length > 1) {
    issues.push({
      code: 'count',
      message: `${plugin.name} accepts one file at a time.`,
    })
  }

  for (const file of files) {
    const typeAccepted = plugin.accepts.includes('*/*') || plugin.accepts.includes(file.type)
    if (!typeAccepted) {
      issues.push({
        code: 'type',
        message: `${file.name} is not supported by ${plugin.name}.`,
      })
    }

    if (file.size > plugin.maxFileSize) {
      issues.push({
        code: 'size',
        message: `${file.name} exceeds the ${formatBytes(plugin.maxFileSize)} limit for ${plugin.name}.`,
      })
    }
  }

  return issues
}
