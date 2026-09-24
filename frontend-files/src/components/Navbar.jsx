import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="border-b border-line">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-tight text-ink">Reel<span className="text-gold">.</span></Link>
        <nav className="flex items-center gap-6 text-sm text-muted">
          <Link to="/" className="hover:text-ink transition-colors">Browse</Link>
          {user?.role === 'admin' && <Link to="/admin" className="hover:text-ink transition-colors">Dashboard</Link>}
          {user ? <button onClick={() => { logout(); navigate('/login'); }} className="text-ink border border-line rounded-full px-4 py-1.5 hover:border-gold transition-colors">Sign out</button> : <Link to="/login" className="text-ink border border-line rounded-full px-4 py-1.5 hover:border-gold transition-colors">Admin sign in</Link>}
        </nav>
      </div>
    </header>
  );
}
