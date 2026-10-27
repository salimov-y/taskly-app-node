import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createQueryWrapper } from '../../../test/queryWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useCreateTodoMutation } from './useCreateTodoMutation'

vi.mock('../api/todos', () => ({
  todosApi: { create: vi.fn() },
}))

const { id: _id, created_at: _c, updated_at: _u, ...input } = todoFixture

it('creates a todo and puts it first in the cached list', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  const existing = { ...todoFixture, id: 1 }
  queryClient.setQueryData(todoKeys.list, [existing])
  vi.mocked(todosApi.create).mockResolvedValue(todoFixture)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(input))
  expect(todosApi.create).toHaveBeenCalledWith(input)
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([
    todoFixture,
    existing,
  ])
})

it('replaces a cached todo with the same id and handles an empty cache', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  vi.mocked(todosApi.create).mockResolvedValue(todoFixture)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(input))
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture])
  await act(() => result.current.mutateAsync(input))
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('exposes the error and leaves the cache untouched when creating fails', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  queryClient.setQueryData(todoKeys.list, [])
  vi.mocked(todosApi.create).mockRejectedValue(new Error('Nope'))
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(input).catch(() => undefined))
  await waitFor(() => expect(result.current.error?.message).toBe('Nope'))
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([])
})
