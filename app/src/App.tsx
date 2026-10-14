import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { Shell } from './components/Shell.tsx'
import { AuthProvider } from './lib/auth.tsx'
import { screens } from './lib/navigation.ts'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { ScreenPage } from './pages/ScreenPage.tsx'
import { PurchasesPage } from './pages/PurchasesPage.tsx'
import { ServicesPage } from './pages/ServicesPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { StockPage } from './pages/StockPage.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function screenElement(path: string) {
  if (path === '/') return <DashboardPage />
  if (path === '/stock') return <StockPage />
  if (path === '/services') return <ServicesPage />
  if (path === '/purchases') return <PurchasesPage />
  if (path === '/settings') return <SettingsPage />
  return <ScreenPage />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<Shell />}>
              {screens.map((screen) => (
                <Route key={screen.id} path={screen.path} element={screenElement(screen.path)} />
              ))}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
