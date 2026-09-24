import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/stats').then((res) => setStats(res.data));
  }, []);

  const cards = [
    { label: 'Users', value: stats?.userCount },
    { label: 'Movies', value: stats?.movieCount },
    { label: 'Total views', value: stats?.totalViews },
    { label: 'Total downloads', value: stats?.totalDownloads }
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Dashboard</h1>
        <div className="flex gap-3">
          <Link
            to="/admin/movies"
            className="border border-line rounded-full px-5 py-2 text-sm hover:border-gold transition-colors"
          >
            Manage movies
          </Link>
          <Link
            to="/admin/movies/new"
            className="bg-gold text-bg rounded-full px-5 py-2 text-sm font-medium hover:bg-goldDeep transition-colors"
          >
            + Add movie
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
        {cards.map((c) => (
          <div key={c.label} className="border border-line rounded-md p-5">
            <p className="text-muted text-sm">{c.label}</p>
            <p className="font-display text-3xl mt-2">{c.value ?? '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
