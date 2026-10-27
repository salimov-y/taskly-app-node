import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { useTodoFilters } from './useTodoFilters'

const active = { ...todoFixture, id: 1, title: 'Write report' }
const done = { ...todoFixture, id: 2, title: 'Buy milk', completed: true }
const todos = [active, done]

it('starts with all todos, no search and newest first', () => {
  const { result } = renderHook(() => useTodoFilters(todos))
  expect(result.current.filter).toBe('all')
  expect(result.current.search).toBe('')
  expect(result.current.sort).toBe('newest')
  expect(result.current.visible).toEqual([done, active])
})

it('filters by status', () => {
  const { result } = renderHook(() => useTodoFilters(todos))
  act(() => result.current.setFilter('completed'))
  expect(result.current.visible).toEqual([done])
  act(() => result.current.setFilter('active'))
  expect(result.current.visible).toEqual([active])
})

it('filters by search text', () => {
  const { result } = renderHook(() => useTodoFilters(todos))
  act(() => result.current.setSearch('MILK'))
  expect(result.current.search).toBe('MILK')
  expect(result.current.visible).toEqual([done])
})

it('changes the sort order', () => {
  const high = { ...todoFixture, id: 3, priority: 'high' as const }
  const { result } = renderHook(() => useTodoFilters([active, high]))
  act(() => result.current.setSort('priority'))
  expect(result.current.sort).toBe('priority')
  expect(result.current.visible).toEqual([high, active])
})
