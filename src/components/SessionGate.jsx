import { useSession } from '../hooks/useSession';
import { Navigate, Outlet } from 'react-router-dom';

export default function SessionGate({ requireAuth, redirectTo }) {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-b from-black to-gray-900 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 border-4 border-transparent border-t-white rounded-full animate-spin" />
          <p className="mt-4 text-lg">Cargando QuizzIA...</p>
        </div>
      </div>
    );
  }
  if (requireAuth && !session) {
    return <Navigate to={redirectTo || '/home'} replace />;
  }
  if (!requireAuth && session) {
    return <Navigate to={redirectTo || '/main'} replace />;
  }
  return <Outlet />;
}
