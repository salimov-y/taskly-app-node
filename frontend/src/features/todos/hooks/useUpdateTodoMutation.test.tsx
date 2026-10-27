import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createQueryWrapper } from '../../../test/queryWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useUpdateTodoMutation } from './useUpdateTodoMutation'

vi.mock('../api/todos', () => ({
  todosApi: { update: vi.fn() },
}))

it('replaces only the updated todo in the cached list', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  const other = { ...todoFixture, id: 1 }
  const saved = { ...todoFixture, completed: true }
  queryClient.setQueryData(todoKeys.list, [todoFixture, other])
  vi.mocked(todosApi.update).mockResolvedValue(saved)
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await act(() =>
    result.current.mutateAsync({
      id: todoFixture.id,
      input: { completed: true },
    }),
  )
  expect(todosApi.update).toHaveBeenCalledWith(todoFixture.id, {
    completed: true,
  })
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([saved, other])
})

it('does not create a cache entry when the list was never loaded', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  vi.mocked(todosApi.update).mockResolvedValue(todoFixture)
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await act(() =>
    result.current.mutateAsync({ id: todoFixture.id, input: { title: 'x' } }),
  )
  expect(queryClient.getQueryData(todoKeys.list)).toBeUndefined()
})

it('keeps the cached list when updating fails', async () => {
  const { queryClient, wrapper } = createQueryWrapper()
  queryClient.setQueryData(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.update).mockRejectedValue(new Error('Nope'))
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await act(() =>
    result.current
      .mutateAsync({ id: todoFixture.id, input: { completed: true } })
      .catch(() => undefined),
  )
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
