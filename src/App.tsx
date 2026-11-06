import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/hooks/useAuth'
import { StoreProvider } from '@/hooks/useStore'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'

// Public pages
import { HomePage } from '@/pages/public/HomePage'
import { CatalogPage } from '@/pages/public/CatalogPage'
import { ProductPage } from '@/pages/public/ProductPage'

// Admin pages
import { LoginPage } from '@/pages/admin/LoginPage'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { ProductsPage } from '@/pages/admin/ProductsPage'
import { ProductFormPage } from '@/pages/admin/ProductFormPage'
import { InventoryPage } from '@/pages/admin/InventoryPage'
import { FinancialPage } from '@/pages/admin/FinancialPage'
import { CategoriesPage } from '@/pages/admin/CategoriesPage'
import { StoreSettingsPage } from '@/pages/admin/StoreSettingsPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <Routes>
            {/* ── Área Pública ─────────────────────────────────────── */}
            <Route path="/" element={<HomePage />} />
            <Route path="/catalogo" element={<CatalogPage />} />
            <Route path="/produto/:slug" element={<ProductPage />} />

            {/* ── Área Administrativa ──────────────────────────────── */}
            <Route path="/admin/login" element={<LoginPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/produtos"
              element={
                <ProtectedRoute>
                  <ProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/produtos/novo"
              element={
                <ProtectedRoute>
                  <ProductFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/produtos/:id/editar"
              element={
                <ProtectedRoute>
                  <ProductFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/estoque"
              element={
                <ProtectedRoute>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/financeiro"
              element={
                <ProtectedRoute>
                  <FinancialPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/categorias"
              element={
                <ProtectedRoute>
                  <CategoriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/configuracoes"
              element={
                <ProtectedRoute>
                  <StoreSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* ── Fallback ─────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                borderRadius: '12px',
                background: '#111827',
                color: '#fff',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
              },
              success: {
                iconTheme: { primary: '#16A34A', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#DC2626', secondary: '#fff' },
              },
            }}
          />
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
