import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Provider, useDispatch, useSelector } from 'react-redux'
import { store } from './store.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Loader from './components/Loader.jsx'
import GlobalLoader from './components/GlobalLoader.jsx'
import {showLoader, hideLoader} from './store/loaderSlice.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Orders from './pages/Orders.jsx'
import Reports from './pages/Reports.jsx'
import Users from './pages/Users.jsx'
import ProductManager from './components/Products/Product.jsx'
import { logout } from './store/authSlice.js'
import ForgotPassword from './components/Session/ForgotPassword.jsx'
import ResetPassword from './components/Session/ResetPassword.jsx'
import RePrintTickets from './components/Print/RePrintTicket.jsx'
import Clients from './components/Clients/Clients.jsx'

function Nav() {

  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const navLinks = [
    { to: '/', label: 'Panel' },
    { to: '/orders', label: 'Ordenes' },
    { to: '/products', label: 'Productos' },
    { to: '/reports', label: 'Reportes' },
    { to: '/settings/users', label: 'Usuarios' },
    { to: '/tickets', label: 'Tickets' },
    { to: '/clients', label: 'Clientes' },
  ]

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo o título */}
        <Link to="/" className="font-semibold text-gray-800">
          PIPI CUCU
        </Link>

        {/* Desktop menu */}
        <div className="hidden md:flex gap-6 items-center">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} className="text-gray-700 hover:text-black transition">
              {link.label}
            </Link>
          ))}
          <button onClick={handleLogout} className="ml-4 text-red-600 hover:text-red-700 font-medium">
            Cerrar Sesión
          </button>
        </div>

        {/* Mobile menu button */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => { handleLogout(); setOpen(false) }}
            className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
          >
            Cerrar Sesión
          </button>
        </div>
      )}
    </nav>
  )
}

function AppContent() {
  const dispatch = useDispatch()
  const loading = useSelector(s => s.auth.loading)

  useEffect(()=>{
    dispatch(showLoader('Iniciando Servidor...'))
    fetch(`${import.meta.env.VITE_API_URL || 'https://serverrest.onrender.com'}/api/health`)
   .then(()=> dispatch(hideLoader()))
   .catch(()=> dispatch(hideLoader()))
  },[dispatch])


  return (
    <>
      <GlobalLoader/>
      {loading && <Loader />}

      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path='/login' element={<Login />} />

          <Route path='/' element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path='/products' element={
            <ProtectedRoute roles={['ADMIN']}>
              <ProductManager />
            </ProtectedRoute>
          } />

          <Route path='/orders' element={
            <ProtectedRoute roles={['ADMIN', 'CAJERO']}>
              <Orders />
            </ProtectedRoute>
          } />

          <Route path='/reports' element={
            <ProtectedRoute roles={['ADMIN', 'CAJERO']}>
              <Reports />
            </ProtectedRoute>
          } />



          <Route path='/settings/users' element={
            <ProtectedRoute roles={['ADMIN']}>
              <Users />
            </ProtectedRoute>
          } />

          <Route path='/clients' element={
            <ProtectedRoute roles={['ADMIN', 'CAJERO']}>
              <Clients />
            </ProtectedRoute>
          } />
          <Route path="/tickets" element={<RePrintTickets />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>

      </BrowserRouter>
    </>
  )

}

export default function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  )
}

