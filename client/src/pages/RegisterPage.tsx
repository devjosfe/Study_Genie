import { Navigate } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import RegisterForm from "../components/auth/RegisterForm.js";

export default function RegisterPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/chat" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <RegisterForm />
    </div>
  );
}
