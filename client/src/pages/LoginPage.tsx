import { Navigate } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import LoginForm from "../components/auth/LoginForm.js";

export default function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/chat" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoginForm />
    </div>
  );
}
