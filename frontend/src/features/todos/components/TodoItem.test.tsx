import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoItem } from './TodoItem'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

afterEach(() => vi.useRealTimers())

function renderItem(
  todo = todoFixture,
  handlers: Partial<
    Record<'onToggle' | 'onEdit' | 'onDelete', () => void>
  > = {},
  busy = false,
) {
  return render(
    <TodoItem
      todo={todo}
      busy={busy}
      onToggle={handlers.onToggle ?? vi.fn()}
      onEdit={handlers.onEdit ?? vi.fn()}
      onDelete={handlers.onDelete ?? vi.fn()}
    />,
  )
}

it('shows a completed task with its description and lets it be reopened', async () => {
  const user = userEvent.setup()
  const onToggle = vi.fn()
  renderItem(
    {
      ...todoFixture,
      completed: true,
      description: 'Slides and notes',
      priority: 'high',
    },
    { onToggle },
  )
  expect(screen.getByText('Slides and notes')).toBeVisible()
  expect(screen.getByText('Completed')).toBeVisible()
  expect(screen.getByText('High')).toBeVisible()
  expect(screen.getByText(`#${todoFixture.id}`)).toBeVisible()
  const checkbox = screen.getByRole('checkbox', {
    name: `Mark as active: ${todoFixture.title}`,
  })
  expect(checkbox).toBeChecked()
  await user.click(checkbox)
  expect(onToggle).toHaveBeenCalledTimes(1)
})

it('completes an active task through its checkbox', async () => {
  const user = userEvent.setup()
  const onToggle = vi.fn()
  renderItem(todoFixture, { onToggle })
  await user.click(
    screen.getByRole('checkbox', { name: `Complete: ${todoFixture.title}` }),
  )
  expect(onToggle).toHaveBeenCalledTimes(1)
})

it('forwards delete requests', async () => {
  const user = userEvent.setup()
  const onDelete = vi.fn()
  renderItem(todoFixture, { onDelete })
  await user.click(
    screen.getByRole('button', { name: `Delete: ${todoFixture.title}` }),
  )
  expect(onDelete).toHaveBeenCalledTimes(1)
})

it('disables every action while busy', () => {
  renderItem(todoFixture, {}, true)
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(
    screen.getByRole('button', { name: `Edit: ${todoFixture.title}` }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: `Delete: ${todoFixture.title}` }),
  ).toBeDisabled()
})

it('shows the due date without an overdue marker when it is in the future', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 10, 12))
  renderItem({ ...todoFixture, due_date: '2026-10-20' })
  expect(screen.getByText(/20 Oct 2026/)).toBeVisible()
  expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
})

it('marks an open task with a past due date as overdue', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 10, 12))
  renderItem({ ...todoFixture, due_date: '2026-10-01' })
  expect(screen.getByText(/1 Oct 2026 · overdue/)).toBeVisible()
})

it('does not mark a completed task as overdue', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 10, 12))
  renderItem({ ...todoFixture, completed: true, due_date: '2026-10-01' })
  expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
})

it('shows an active task and forwards edit requests', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const onToggle = vi.fn()
  const onDelete = vi.fn()
  render(
    <TodoItem
      todo={todoFixture}
      busy={false}
      onEdit={onEdit}
      onToggle={onToggle}
      onDelete={onDelete}
    />,
  )
  expect(screen.getByRole('heading', { name: todoFixture.title })).toBeVisible()
  expect(screen.getByText('To do')).toBeVisible()
  expect(screen.getByText('Medium')).toBeVisible()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  await user.click(
    screen.getByRole('button', { name: `Edit: ${todoFixture.title}` }),
  )
  expect(onEdit).toHaveBeenCalledTimes(1)
  expect(onToggle).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
})
