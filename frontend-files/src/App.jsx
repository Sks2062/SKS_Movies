import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import MovieDetails from './pages/MovieDetails.jsx';
import WatchMovie from './pages/WatchMovie.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import AddMovie from './pages/admin/AddMovie.jsx';
import ManageMovies from './pages/admin/ManageMovies.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/movies/:id" element={<MovieDetails />} />
        <Route path="/watch/:id" element={<ProtectedRoute><WatchMovie /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/movies" element={<ProtectedRoute adminOnly><ManageMovies /></ProtectedRoute>} />
        <Route path="/admin/movies/new" element={<ProtectedRoute adminOnly><AddMovie /></ProtectedRoute>} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
