import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createInputFile, revokeInputFiles, revokeOutputs } from '../files/file-helpers'
import type { FileValidationIssue, InputFile } from '../files/types'
import type { ToolJobRecord, ToolSession } from './types'

interface ToolkitPreferences {
  recentToolIds: string[]
}

interface ToolkitState {
  sessions: Record<string, ToolSession>
  preferences: ToolkitPreferences
  setInputs: (toolId: string, files: File[]) => void
  removeInput: (toolId: string, inputId: string) => void
  clearSession: (toolId: string) => void
  setJob: (toolId: string, job: ToolJobRecord) => void
  setJobProgress: (toolId: string, progress: ToolJobRecord['progress']) => void
  finishJob: (toolId: string, job: ToolJobRecord) => void
  rememberTool: (toolId: string) => void
}

const emptyJob = (toolId: string): ToolJobRecord => ({
  id: `${toolId}-idle`,
  toolId,
  status: 'idle',
  progress: {
    phase: 'idle',
    value: 0,
    message: 'Ready',
  },
  warnings: [],
})

function ensureSession(sessions: Record<string, ToolSession>, toolId: string): ToolSession {
  return sessions[toolId] ?? { toolId, inputs: [], job: emptyJob(toolId) }
}

export const useToolkitStore = create<ToolkitState>()(
  persist(
    (set, get) => ({
      sessions: {},
      preferences: {
        recentToolIds: [],
      },
      setInputs: (toolId, files) => {
        set((state) => {
          const session = ensureSession(state.sessions, toolId)
          revokeInputFiles(session.inputs)
          const inputs = files.map(createInputFile)
          return {
            sessions: {
              ...state.sessions,
              [toolId]: { ...session, inputs, job: emptyJob(toolId) },
            },
          }
        })
      },
      removeInput: (toolId, inputId) => {
        set((state) => {
          const session = ensureSession(state.sessions, toolId)
          const nextInputs: InputFile[] = []
          for (const item of session.inputs) {
            if (item.id === inputId) {
              revokeInputFiles([item])
            } else {
              nextInputs.push(item)
            }
          }
          return {
            sessions: {
              ...state.sessions,
              [toolId]: { ...session, inputs: nextInputs },
            },
          }
        })
      },
      clearSession: (toolId) => {
        set((state) => {
          const session = state.sessions[toolId]
          if (session) {
            revokeInputFiles(session.inputs)
            if (session.job.result) revokeOutputs(session.job.result.outputs)
          }
          const nextSessions = { ...state.sessions }
          delete nextSessions[toolId]
          return { sessions: nextSessions }
        })
      },
      setJob: (toolId, job) => {
        set((state) => {
          const session = ensureSession(state.sessions, toolId)
          if (session.job.result) revokeOutputs(session.job.result.outputs)
          return {
            sessions: {
              ...state.sessions,
              [toolId]: { ...session, job },
            },
          }
        })
      },
      setJobProgress: (toolId, progress) => {
        set((state) => {
          const session = ensureSession(state.sessions, toolId)
          return {
            sessions: {
              ...state.sessions,
              [toolId]: {
                ...session,
                job: {
                  ...session.job,
                  progress,
                },
              },
            },
          }
        })
      },
      finishJob: (toolId, job) => {
        set((state) => {
          const session = ensureSession(state.sessions, toolId)
          if (session.job.result) revokeOutputs(session.job.result.outputs)
          return {
            sessions: {
              ...state.sessions,
              [toolId]: { ...session, job },
            },
          }
        })
      },
      rememberTool: (toolId) => {
        const previous = get().preferences.recentToolIds.filter((value) => value !== toolId)
        set({
          preferences: {
            recentToolIds: [toolId, ...previous].slice(0, 5),
          },
        })
      },
    }),
    {
      name: 'toolkit-preferences',
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    },
  ),
)

export function collectValidationSummary(issues: FileValidationIssue[]) {
  return Array.from(new Set(issues.map((issue) => issue.message)))
}
