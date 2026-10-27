import { render, screen } from '@testing-library/react'
import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { GlobalStyles } from '../design-system'
import { queryClient } from '../lib/queryClient'
import { AppProviders } from './AppProviders'

vi.mock('../design-system', () => import('../design-system/mocks'))

function Probe() {
  const client = useQueryClient()
  return <p>{client === queryClient ? 'default' : 'custom'}</p>
}

it('renders children with the default query client and global styles', () => {
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )
  expect(screen.getByText('default')).toBeVisible()
  expect(GlobalStyles).toHaveBeenCalled()
})

it('uses the query client passed in', () => {
  render(
    <AppProviders client={new QueryClient()}>
      <Probe />
    </AppProviders>,
  )
  expect(screen.getByText('custom')).toBeVisible()
})
