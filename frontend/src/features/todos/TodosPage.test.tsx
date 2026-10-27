import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNotice } from '../../hooks/useNotice'
import { todoFixture } from '../../test/todoFixture'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import { TodosPage } from './TodosPage'
import type { Todo } from './types'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: ({
    disabled,
    onCreate,
  }: {
    disabled: boolean
    onCreate: () => void
  }) => (
    <header>
      <h1>Tasks</h1>
      <button disabled={disabled} onClick={onCreate}>
        New task
      </button>
    </header>
  ),
}))
vi.mock('./components/TodoFilters', () => ({ TodoFilters: () => null }))
vi.mock('./components/TodoList', () => ({
  TodoList: ({
    todos,
    hasTodos,
    loading,
    failed,
    busy,
    onCreate,
    onToggle,
    onEdit,
    onDelete,
  }: {
    todos: Todo[]
    hasTodos: boolean
    loading: boolean
    failed: boolean
    busy: boolean
    onCreate: () => void
    onToggle: (todo: Todo) => void
    onEdit: (todo: Todo) => void
    onDelete: (todo: Todo) => void
  }) => (
    <section>
      <p>{`list:${todos.length} has:${hasTodos} loading:${loading} failed:${failed} busy:${busy}`}</p>
      <button onClick={onCreate}>Empty create</button>
      <button onClick={() => onToggle(todoFixture)}>Toggle item</button>
      <button onClick={() => onEdit(todoFixture)}>Edit item</button>
      <button onClick={() => onDelete(todoFixture)}>Delete item</button>
    </section>
  ),
}))
vi.mock('./components/TodoEditor', () => ({
  TodoEditor: ({
    todo,
    onClose,
    onSaved,
  }: {
    todo: Todo | 'new'
    onClose: () => void
    onSaved: (notice: string) => void
  }) => (
    <div role="dialog" aria-label="Editor">
      <span>{todo === 'new' ? 'editing new' : `editing ${todo.id}`}</span>
      <button onClick={onClose}>Close editor</button>
      <button onClick={() => onSaved('Saved notice')}>Save editor</button>
    </div>
  ),
}))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: ({
    todo,
    onClose,
    onDeleted,
  }: {
    todo: Todo
    onClose: () => void
    onDeleted: () => void
  }) => (
    <div role="dialog" aria-label="Delete">
      <span>{`deleting ${todo.id}`}</span>
      <button onClick={onClose}>Close delete</button>
      <button onClick={onDeleted}>Confirm delete</button>
    </div>
  ),
}))
vi.mock('../../components/SuccessNotice', () => ({
  SuccessNotice: ({ message }: { message: string }) => (
    <p data-testid="notice">{message}</p>
  ),
}))

function setup({
  query = {},
  mutation = {},
  busy = false,
}: { query?: object; mutation?: object; busy?: boolean } = {}) {
  const notify = vi.fn()
  const refetch = vi.fn().mockResolvedValue(undefined)
  const reset = vi.fn()
  const mutateAsync = vi.fn()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [todoFixture],
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch,
    ...query,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset,
    mutateAsync,
    ...mutation,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(busy)
  vi.mocked(useNotice).mockReturnValue({ message: 'Hello notice', notify })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [todoFixture],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  return { notify, refetch, reset, mutateAsync }
}

beforeEach(() => vi.clearAllMocks())

it('displays a query failure and resets mutation errors before retrying', async () => {
  const user = userEvent.setup()
  const { refetch, reset } = setup({
    query: {
      data: [],
      isError: true,
      error: new Error('The server is unavailable.'),
    },
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'The server is unavailable.',
  )
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  expect(reset).toHaveBeenCalledTimes(1)
  expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
    refetch.mock.invocationCallOrder[0],
  )
})

it('shows the list state, the notice and no alert without errors', () => {
  setup()
  render(<TodosPage />)
  expect(
    screen.getByText('list:1 has:true loading:false failed:false busy:false'),
  ).toBeVisible()
  expect(screen.getByTestId('notice')).toHaveTextContent('Hello notice')
  expect(screen.queryByTestId('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('treats missing data as an empty list', () => {
  setup({ query: { data: undefined, isPending: true } })
  render(<TodosPage />)
  expect(
    screen.getByText('list:1 has:false loading:true failed:false busy:false'),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'New task' })).toBeDisabled()
})

it('shows the mutation error in preference to the query error', () => {
  setup({
    query: { error: new Error('Query failed') },
    mutation: { error: new Error('Update failed') },
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent('Update failed')
})

it('disables retry and creation while busy or fetching', () => {
  setup({ busy: true, query: { error: new Error('Down'), isFetching: true } })
  render(<TodosPage />)
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'New task' })).toBeDisabled()
})

it('disables retry while fetching', () => {
  setup({ query: { error: new Error('Down'), isFetching: true } })
  render(<TodosPage />)
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
})

it('completes an active task and announces it', async () => {
  const user = userEvent.setup()
  const { mutateAsync, notify } = setup()
  mutateAsync.mockResolvedValue({ ...todoFixture, completed: true })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Toggle item' }))
  expect(mutateAsync).toHaveBeenCalledWith({
    id: todoFixture.id,
    input: { completed: true },
  })
  expect(notify).toHaveBeenCalledWith('Another task complete. Well done!')
})

it('reopens a completed task and announces it', async () => {
  const user = userEvent.setup()
  const { mutateAsync, notify } = setup()
  mutateAsync.mockResolvedValue({ ...todoFixture, completed: false })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Toggle item' }))
  expect(notify).toHaveBeenCalledWith('Task marked as active.')
})

it('does not announce a toggle that failed', async () => {
  const user = userEvent.setup()
  const { mutateAsync, notify } = setup()
  mutateAsync.mockRejectedValue(new Error('Failed'))
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Toggle item' }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
  expect(notify).not.toHaveBeenCalled()
})

it('ignores toggles while busy', async () => {
  const user = userEvent.setup()
  const { mutateAsync } = setup({ busy: true })
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Toggle item' }))
  expect(mutateAsync).not.toHaveBeenCalled()
})

it('opens the editor for a new task from the header and closes it', async () => {
  const user = userEvent.setup()
  setup()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'New task' }))
  expect(screen.getByText('editing new')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Close editor' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('opens the editor for a new task from the empty list', async () => {
  const user = userEvent.setup()
  setup()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Empty create' }))
  expect(screen.getByText('editing new')).toBeVisible()
})

it('opens the editor for an existing task and announces the save', async () => {
  const user = userEvent.setup()
  const { notify } = setup()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Edit item' }))
  expect(screen.getByText(`editing ${todoFixture.id}`)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Save editor' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).toHaveBeenCalledWith('Saved notice')
})

it('asks for confirmation before deleting and can cancel', async () => {
  const user = userEvent.setup()
  const { notify } = setup()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Delete item' }))
  expect(screen.getByText(`deleting ${todoFixture.id}`)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Close delete' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).not.toHaveBeenCalled()
})

it('announces a deleted task and closes the dialog', async () => {
  const user = userEvent.setup()
  const { notify } = setup()
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Delete item' }))
  await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).toHaveBeenCalledWith('Task deleted.')
})
