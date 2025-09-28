import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Loader from "./components/ui/Loader";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader label="Authenticating..." fullScreen />;
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}