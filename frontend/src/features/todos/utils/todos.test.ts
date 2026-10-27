import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDate, isOverdue, selectTodos, validateTodo } from './todos'
import type { Todo } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })

  it('filters completed tasks', () => {
    const done = { ...base, id: 2, completed: true }
    expect(selectTodos([base, done], 'completed', '', 'newest')).toEqual([done])
  })

  it('sorts by newest creation date, newest id first on ties', () => {
    const newer = { ...base, id: 2, created_at: '2026-10-02T12:00:00Z' }
    const tie = { ...base, id: 3 }
    expect(selectTodos([base, tie, newer], 'all', '', 'newest')).toEqual([
      newer,
      tie,
      base,
    ])
  })

  it('sorts by priority with the newest id first on ties', () => {
    const low = { ...base, id: 2, priority: 'low' as const }
    const medium = { ...base, id: 3 }
    expect(selectTodos([low, base, medium], 'all', '', 'priority')).toEqual([
      medium,
      base,
      low,
    ])
  })

  it('sorts by due date with undated tasks last', () => {
    const undated = { ...base, id: 2 }
    const late = { ...base, id: 3, due_date: '2026-12-01' }
    const early = { ...base, id: 4, due_date: '2026-11-01' }
    const sameDay = { ...base, id: 5, due_date: '2026-11-01' }
    expect(
      selectTodos([undated, late, early, sameDay], 'all', '', 'due'),
    ).toEqual([sameDay, early, late, undated])
  })
})

describe('validateTodo', () => {
  const valid = {
    title: 'Plan',
    description: '',
    priority: 'medium' as const,
    due_date: null,
    completed: false,
  }

  it('accepts valid input', () => {
    expect(validateTodo(valid)).toEqual({})
    expect(validateTodo({ ...valid, due_date: '2026-02-28' })).toEqual({})
  })

  it('requires a title after trimming', () => {
    expect(validateTodo({ ...valid, title: '   ' })).toEqual({
      title: 'Enter a task title.',
    })
  })

  it('limits the title and description length after trimming', () => {
    expect(validateTodo({ ...valid, title: 'x'.repeat(120) })).toEqual({})
    expect(validateTodo({ ...valid, title: ` ${'x'.repeat(121)} ` })).toEqual({
      title: 'The title must be at most 120 characters.',
    })
    expect(validateTodo({ ...valid, description: 'x'.repeat(2000) })).toEqual(
      {},
    )
    expect(validateTodo({ ...valid, description: 'x'.repeat(2001) })).toEqual({
      description: 'The description must be at most 2000 characters.',
    })
  })

  it.each(['2026-02-30', '2026-13-01', 'tomorrow', '2026-1-1'])(
    'rejects the due date %s',
    (due_date) => {
      expect(validateTodo({ ...valid, due_date })).toEqual({
        due_date: 'Enter a valid date.',
      })
    },
  )
})

describe('isOverdue', () => {
  afterEach(() => vi.useRealTimers())

  it.each([
    ['a past due date', '2026-10-14', false, true],
    ['today', '2026-10-15', false, false],
    ['a future due date', '2026-10-16', false, false],
    ['no due date', null, false, false],
    ['a completed task', '2026-10-14', true, false],
  ])('handles %s', (_name, due_date, completed, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 15, 12))
    expect(isOverdue({ ...base, due_date, completed })).toBe(expected)
  })
})

describe('formatDate', () => {
  it('formats an ISO date for display', () => {
    expect(formatDate('2026-10-05')).toBe('5 Oct 2026')
  })
})
