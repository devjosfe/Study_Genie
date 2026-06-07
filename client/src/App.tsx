import { Routes, Route, Navigate } from "react-router";
import Layout from "./components/layout/Layout.js";
import HomePage from "./pages/HomePage.js";
import LoginPage from "./pages/LoginPage.js";
import RegisterPage from "./pages/RegisterPage.js";
import ChatPage from "./pages/ChatPage.js";
import DocumentsPage from "./pages/DocumentsPage.js";
import QuizPage from "./pages/QuizPage.js";
import InterviewPage from "./pages/InterviewPage.js";
import DashboardPage from "./pages/DashboardPage.js";
import PricingPage from "./pages/PricingPage.js";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/pricing" element={<PricingPage />} />

      {/* Protected routes */}
      <Route element={<Layout />}>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
