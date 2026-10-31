import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './store/useAuth';
import { useChat } from './store/useChat';
import { ToastHost, Spinner } from './components/ui';
import { toast } from './store/useToast';
import AppLayout from './layouts/AppLayout';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import AgentsPage from './pages/AgentsPage';
import ModelsPage from './pages/ModelsPage';
import KeysPage from './pages/KeysPage';
import UsagePage from './pages/UsagePage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';

function Guard() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="flex h-full items-center justify-center text-zinc-400"><Spinner size={24} /></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    init();
    const expired = () => { if (useAuth.getState().user) { toast.error('Your session expired. Please sign in again.'); useAuth.getState().logout(); useChat.getState().newChat(); } };
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [init]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<Guard />}>
          <Route element={<AppLayout />}>
            <Route index element={<ChatPage />} />
            <Route path="c/:id" element={<ChatPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="keys" element={<KeysPage />} />
            <Route path="usage" element={<UsagePage />} />
            <Route path="saved" element={<HistoryPage savedOnly />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </BrowserRouter>
  );
}
