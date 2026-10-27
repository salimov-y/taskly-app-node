import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createQueryWrapper } from '../../../test/queryWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useClearCompletedMutation } from './useClearCompletedMutation'

vi.mock('../api/todos', () => ({
  todosApi: { clearCompleted: vi.fn() },
}))

it('removes completed todos from the cached list', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  const active = { ...todoFixture, id: 1, completed: false }
  const done = { ...todoFixture, id: 2, completed: true }
  queryClient.setQueryData(todoKeys.list, [active, done])
  vi.mocked(todosApi.clearCompleted).mockResolvedValue({ deleted: 1 })
  const { result } = renderHook(() => useClearCompletedMutation(), { wrapper })
  await act(async () => {
    await expect(result.current.mutateAsync()).resolves.toEqual({ deleted: 1 })
  })
  expect(todosApi.clearCompleted).toHaveBeenCalledTimes(1)
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([active])
})

it('does not create a cache entry when the list was never loaded', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  vi.mocked(todosApi.clearCompleted).mockResolvedValue({ deleted: 0 })
  const { result } = renderHook(() => useClearCompletedMutation(), { wrapper })
  await act(() => result.current.mutateAsync())
  expect(queryClient.getQueryData(todoKeys.list)).toBeUndefined()
})

it('keeps the cached list when clearing fails', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  const done = { ...todoFixture, completed: true }
  queryClient.setQueryData(todoKeys.list, [done])
  vi.mocked(todosApi.clearCompleted).mockRejectedValue(new Error('Nope'))
  const { result } = renderHook(() => useClearCompletedMutation(), { wrapper })
  await act(() => result.current.mutateAsync().catch(() => undefined))
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([done])
})
