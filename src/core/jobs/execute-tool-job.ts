import { attachObjectUrls } from '../files/file-helpers'
import type { ToolPlugin } from '../plugins/types'
import { useToolkitStore } from './toolkit-store'

async function runJob(tool: ToolPlugin, options: any, controller: AbortController) {
  const session = useToolkitStore.getState().sessions[tool.id]
  const inputs = session?.inputs ?? []
  if (tool.requiresFile !== false && inputs.length === 0) return

  const startedAt = Date.now()
  useToolkitStore.getState().setJob(tool.id, {
    id: crypto.randomUUID(),
    toolId: tool.id,
    status: 'running',
    progress: {
      phase: 'preparing',
      value: 0.04,
      message: 'Preparing files',
    },
    warnings: [],
    startedAt,
  })

  try {
    const module = await tool.load()
    const result = await module.run(inputs, options, {
      signal: controller.signal,
      onProgress(progress) {
        const currentJob = useToolkitStore.getState().sessions[tool.id]?.job
        if (!currentJob) return
        useToolkitStore.getState().setJobProgress(tool.id, {
          phase: progress.phase ?? currentJob.progress.phase,
          value: progress.value ?? currentJob.progress.value,
          message: progress.message,
        })
      },
    })
    const outputs = attachObjectUrls(result.outputs)

    useToolkitStore.getState().finishJob(tool.id, {
      ...useToolkitStore.getState().sessions[tool.id].job,
      status: 'succeeded',
      progress: {
        phase: 'finalizing',
        value: 1,
        message: 'Ready to download',
      },
      result: {
        ...result,
        outputs,
        preview: {
          ...result.preview,
          objectUrl: result.preview.objectUrl ?? (result.preview.kind === 'image' ? outputs[0]?.objectUrl : result.preview.objectUrl),
        },
      },
      warnings: result.warnings ?? [],
      finishedAt: Date.now(),
    })
  } catch (error) {
    // Don't surface abort errors as failures — user intentionally canceled
    if (controller.signal.aborted) return
    const message = error instanceof Error ? error.message : 'The tool could not process these files.'
    useToolkitStore.getState().finishJob(tool.id, {
      ...useToolkitStore.getState().sessions[tool.id].job,
      status: 'failed',
      progress: {
        phase: 'finalizing',
        value: 1,
        message: 'Processing failed',
      },
      error: message,
      warnings: [],
      finishedAt: Date.now(),
    })
  }
}

// Fix #49/#50: return { promise, abort } so the caller can cancel in-flight jobs
export function executeToolJob(tool: ToolPlugin, options: any): { promise: Promise<void>; abort: () => void } {
  const controller = new AbortController()
  const promise = runJob(tool, options, controller)
  return { promise, abort: () => controller.abort() }
}
