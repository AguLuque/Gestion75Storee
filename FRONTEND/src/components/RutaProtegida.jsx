import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from './ui/index.jsx';

export default function RutaProtegida({ children }) {
  const { sesion, cargando } = useAuth();

  if (cargando) return <Spinner />;
  if (!sesion) return <Navigate to="/login" replace />;

  return children;
}