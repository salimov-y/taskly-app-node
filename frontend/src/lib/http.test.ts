import { afterEach, expect, it, vi } from 'vitest'
import { request } from './http'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn()
  if (response instanceof Error) fetchMock.mockRejectedValue(response)
  else fetchMock.mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

it('prefixes the path with /api and sends JSON headers', async () => {
  const fetchMock = stubFetch(new Response(JSON.stringify([{ id: 1 }])))
  await expect(request('/todos')).resolves.toEqual([{ id: 1 }])
  expect(fetchMock).toHaveBeenCalledWith('/api/todos', {
    headers: { 'Content-Type': 'application/json' },
  })
})

it('keeps the init options and lets callers override headers', async () => {
  const fetchMock = stubFetch(new Response('{}'))
  await request('/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'X-Test': '1' },
  })
  expect(fetchMock).toHaveBeenCalledWith('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'X-Test': '1' },
  })
})

it('returns undefined for 204 responses', async () => {
  stubFetch(new Response(null, { status: 204 }))
  await expect(
    request('/todos/1', { method: 'DELETE' }),
  ).resolves.toBeUndefined()
})

it('reports a connection error when the request fails', async () => {
  stubFetch(new TypeError('network'))
  await expect(request('/todos')).rejects.toThrow(
    'Cannot connect to the server. Please try again.',
  )
})

it('rethrows the original error when the request was aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  const abortError = new DOMException('aborted', 'AbortError')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))
  await expect(request('/todos', { signal: controller.signal })).rejects.toBe(
    abortError,
  )
})

it('shows a validation message for 422 responses', async () => {
  stubFetch(new Response(JSON.stringify({ detail: [] }), { status: 422 }))
  await expect(request('/todos')).rejects.toThrow(
    'Check the task details: title up to 120 characters, description up to 2000 characters, and a valid due date.',
  )
})

it('uses the string detail of an error response', async () => {
  stubFetch(
    new Response(JSON.stringify({ detail: 'Task not found.' }), {
      status: 404,
    }),
  )
  await expect(request('/todos/1')).rejects.toThrow('Task not found.')
})

it.each([
  ['a non string detail', JSON.stringify({ detail: [1] })],
  ['a body that is not JSON', 'oops'],
])('uses a generic message for %s', async (_name, body) => {
  stubFetch(new Response(body, { status: 500 }))
  await expect(request('/todos')).rejects.toThrow(
    'The operation failed. Please try again.',
  )
})
