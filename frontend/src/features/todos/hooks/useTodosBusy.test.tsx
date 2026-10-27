import { renderHook, waitFor } from '@testing-library/react'
import { useMutation } from '@tanstack/react-query'
import { expect, it } from 'vitest'
import { createQueryWrapper } from '../../../test/queryWrapper'
import { todoKeys } from '../api/queryKeys'
import { useTodosBusy } from './useTodosBusy'

it('is idle without running mutations', () => {
  const { wrapper } = createQueryWrapper()
  const { result } = renderHook(() => useTodosBusy(), { wrapper })
  expect(result.current).toBe(false)
})

it('is busy while a todo mutation runs and idle afterwards', async () => {
  const { wrapper } = createQueryWrapper()
  let release: () => void = () => undefined
  const { result } = renderHook(
    () => ({
      busy: useTodosBusy(),
      mutation: useMutation({
        mutationKey: todoKeys.update,
        mutationFn: () => new Promise<void>((resolve) => (release = resolve)),
      }),
    }),
    { wrapper },
  )
  result.current.mutation.mutate()
  await waitFor(() => expect(result.current.busy).toBe(true))
  release()
  await waitFor(() => expect(result.current.busy).toBe(false))
})

it('ignores mutations outside the todos keys', async () => {
  const { wrapper } = createQueryWrapper()
  let release: () => void = () => undefined
  const { result } = renderHook(
    () => ({
      busy: useTodosBusy(),
      mutation: useMutation({
        mutationKey: ['other'],
        mutationFn: () => new Promise<void>((resolve) => (release = resolve)),
      }),
    }),
    { wrapper },
  )
  result.current.mutation.mutate()
  await waitFor(() => expect(result.current.mutation.isPending).toBe(true))
  expect(result.current.busy).toBe(false)
  release()
  await waitFor(() => expect(result.current.mutation.isPending).toBe(false))
})
