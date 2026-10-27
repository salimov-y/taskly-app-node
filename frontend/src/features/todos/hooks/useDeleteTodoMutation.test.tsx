import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createQueryWrapper } from '../../../test/queryWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'

vi.mock('../api/todos', () => ({
  todosApi: { remove: vi.fn() },
}))

it('removes the todo from the cached list', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  const other = { ...todoFixture, id: 1 }
  queryClient.setQueryData(todoKeys.list, [todoFixture, other])
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(todoFixture.id))
  expect(todosApi.remove).toHaveBeenCalledWith(todoFixture.id)
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([other])
})

it('does not create a cache entry when the list was never loaded', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(todoFixture.id))
  expect(queryClient.getQueryData(todoKeys.list)).toBeUndefined()
})

it('keeps the cached list when deleting fails', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  queryClient.setQueryData(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.remove).mockRejectedValue(new Error('Nope'))
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await act(() =>
    result.current.mutateAsync(todoFixture.id).catch(() => undefined),
  )
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
