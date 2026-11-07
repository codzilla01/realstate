import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Forbidden from "../pages/Forbidden";

export default function RequireRole({ allow, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/admin/login" replace />;
  if (allow && !allow.includes(user.role)) return <Forbidden />;
  return children;
}
