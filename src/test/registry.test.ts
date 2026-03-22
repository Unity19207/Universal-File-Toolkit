import { describe, it, expect } from 'vitest'
import { toolRegistry, getToolById } from '../core/plugins/registry'

describe('Plugin Registry', () => {
  it('should have at least 6 tools', () => {
    expect(toolRegistry.length).toBeGreaterThanOrEqual(6)
  })

  it('every tool has required fields', () => {
    toolRegistry.forEach((tool) => {
      expect(tool.id, `${tool.id} missing id`).toBeDefined()
      expect(tool.id.length).toBeGreaterThan(0)
      expect(tool.name, `${tool.id} missing name`).toBeDefined()
      expect(tool.description, `${tool.id} missing description`).toBeDefined()
      expect(tool.category, `${tool.id} missing category`).toBeDefined()
      expect(tool.load, `${tool.id} missing load`).toBeTypeOf('function')
      expect(Array.isArray(tool.accepts), `${tool.id} accepts must be array`).toBe(true)
    })
  })

  it('all tool IDs are unique', () => {
    const ids = toolRegistry.map((t) => t.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('all tools have valid categories', () => {
    const validCategories = ['image', 'pdf', 'data', 'text', 'media', 'developer', 'archive']
    toolRegistry.forEach((tool) => {
      expect(validCategories, `${tool.id} has unknown category: ${tool.category}`).toContain(tool.category)
    })
  })

  it('getToolById returns correct tool', () => {
    const first = toolRegistry[0]
    const found = getToolById(first.id)
    expect(found).toBeDefined()
    expect(found?.id).toBe(first.id)
  })

  it('getToolById returns undefined for unknown id', () => {
    expect(getToolById('non-existent-tool-xyz')).toBeUndefined()
  })
})
