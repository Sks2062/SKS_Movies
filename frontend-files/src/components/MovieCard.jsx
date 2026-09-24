import { Link } from 'react-router-dom';

export default function MovieCard({ movie }) {
  return (
    <Link to={`/movies/${movie._id}`} className="group block">
      <div className="aspect-[2/3] overflow-hidden bg-elevated border border-line rounded-sm">
        {movie.posterUrl ? <img src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" /> : <div className="w-full h-full flex items-center justify-center text-muted text-sm">No poster</div>}
      </div>
      <h3 className="font-display text-lg mt-3 leading-snug">{movie.title}</h3>
      <p className="text-muted text-sm mt-1">{movie.releaseYear}{movie.genre?.length ? ` · ${movie.genre.join(', ')}` : ''}</p>
    </Link>
  );
}
