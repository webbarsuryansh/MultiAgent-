import { LogOut, Mail, User, Crown, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { useAuth } from '../store/useAuth';
import { useChat } from '../store/useChat';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const rows = [[User, 'Username', user.username], [Mail, 'Email', user.email], [Crown, 'Plan', `${user.subscriptionPlan}${user.role === 'admin' ? ' (admin)' : ''}`], [Calendar, 'Joined', new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })]];
  return (
    <PageShell title="Profile">
      <div className="panel max-w-xl divide-y divide-line">
        {rows.map(([I, l, v]) => <div key={l} className="flex items-center gap-4 px-5 py-4"><I size={17} className="text-zinc-500" /><span className="w-24 text-sm text-zinc-400">{l}</span><span className="text-sm font-medium capitalize-first text-zinc-100 [overflow-wrap:anywhere]">{v}</span></div>)}
      </div>
      <button className="btn-outline mt-6" onClick={() => { logout(); useChat.getState().newChat(); nav('/login'); }}><LogOut size={16} />Sign out</button>
    </PageShell>
  );
}
