import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { AppShell } from './components/AppShell'
import { PipelinePage } from './pages/Pipeline'
import { DealsPage } from './pages/Deals'
import { DealDetailPage } from './pages/DealDetail'
import { DashboardPage } from './pages/Dashboard'
import { SettingsPage } from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
})

// Pages serves the app from /<repo>/, so the router needs that prefix.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <PipelinePage /> },
        { path: 'deals', element: <DealsPage /> },
        { path: 'deals/:dealId', element: <DealDetailPage /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'settings', element: <SettingsPage /> },
      ],
    },
  ],
  { basename: basename || '/' },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
