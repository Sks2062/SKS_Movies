const Movie = require('./Movie');
const User = require('./User');
const { getMuxClient } = require('./muxClient');
const { Readable } = require('stream');

const getTeraBoxConfig = () => {
  const accessToken = process.env.TERABOX_ACCESS_TOKEN;
  const apiDomain = process.env.TERABOX_API_DOMAIN || 'www.terabox.com';
  if (!accessToken) return { error: 'TeraBox streaming is not configured. Set TERABOX_ACCESS_TOKEN on the server.' };
  if (!/^(?:[a-z0-9-]+\.)*(?:terabox\.com|1024tera\.com)$/i.test(apiDomain)) {
    return { error: 'TERABOX_API_DOMAIN must be a TeraBox API host.' };
  }
  return { accessToken, apiDomain };
};

const isTeraBoxCdnUrl = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && [
      'terabox.com', '1024tera.com', 'teraboxcdn.com'
    ].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

const getTeraBoxFilePath = (videoUrl) => {
  try {
    const url = new URL(videoUrl);
    const filePath = url.searchParams.get('path');
    return filePath?.startsWith('/') ? filePath : '';
  } catch {
    return '';
  }
};

const getMovieForTeraBoxStream = async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  if (!movie) {
    res.status(404).json({ message: 'Movie not found' });
    return null;
  }
  if (!movie.allowStreaming) {
    res.status(403).json({ message: 'Streaming is not enabled for this title' });
    return null;
  }
  if (movie.videoProvider !== 'terabox') {
    res.status(400).json({ message: 'This movie does not use TeraBox streaming' });
    return null;
  }
  return movie;
};

const getTeraBoxManifest = async (movie) => {
  const config = getTeraBoxConfig();
  if (config.error) throw Object.assign(new Error(config.error), { status: 503 });

  const filePath = getTeraBoxFilePath(movie.videoUrl);
  if (!filePath) {
    throw Object.assign(
      new Error('This TeraBox URL has no file path. Use a TeraBox player URL with a path parameter.'),
      { status: 400 }
    );
  }

  const apiUrl = new URL('/openapi/api/streaming', `https://${config.apiDomain}`);
  apiUrl.searchParams.set('access_tokens', config.accessToken);
  apiUrl.searchParams.set('path', filePath);
  apiUrl.searchParams.set('type', 'M3U8_AUTO_720');

  const upstream = await fetch(apiUrl);
  if (!upstream.ok) throw Object.assign(new Error('TeraBox could not provide this video stream.'), { status: 502 });
  const manifest = await upstream.text();
  if (!manifest.trimStart().startsWith('#EXTM3U')) {
    throw Object.assign(new Error('TeraBox did not return a playable video stream. Check the account access and file path.'), { status: 502 });
  }
  return { manifest, baseUrl: upstream.url };
};

const proxyUrl = (req, movieId, remoteUrl) => {
  const resolved = new URL(remoteUrl);
  if (!isTeraBoxCdnUrl(resolved.href)) {
    throw new Error('TeraBox returned a stream URL on an unsupported host.');
  }
  return `/api/movies/${movieId}/terabox/segment?target=${encodeURIComponent(resolved.href)}`;
};

const rewriteTeraBoxManifest = (req, movieId, manifest, baseUrl) => manifest
  .split(/\r?\n/)
  .map((line) => {
    const value = line.trim();
    if (!value) return line;
    if (value.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
        const target = new URL(uri, baseUrl).href;
        return `URI="${proxyUrl(req, movieId, target)}"`;
      });
    }
    return proxyUrl(req, movieId, new URL(value, baseUrl).href);
  })
  .join('\n');

// @route GET /api/movies?search=&genre=
const listMovies = async (req, res) => {
  try {
    const { search, genre } = req.query;
    const query = {};

    if (search) query.$text = { $search: search };
    if (genre) query.genre = genre;

    const movies = await Movie.find(query).select('-videoUrl -downloadUrl').sort({ createdAt: -1 });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/movies/:id
const getMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).select('-videoUrl -downloadUrl');
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    res.json(movie);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/movies/:id/stream
// Verifies access, then would return a signed/temporary URL from
// your storage provider (e.g. S3 presigned URL) instead of a raw file path.
const streamMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    if (!movie.allowStreaming) {
      return res.status(403).json({ message: 'Streaming is not enabled for this title' });
    }
    if (movie.muxPlaybackId && movie.muxStatus !== 'ready') {
      return res.status(409).json({ message: 'This video is still processing' });
    }
    if (!movie.muxPlaybackId && !movie.videoUrl) {
      return res.status(409).json({ message: 'This video is not ready for streaming' });
    }

    let muxTokens;
    if (movie.muxPlaybackId) {
      if (!process.env.MUX_SIGNING_KEY || !process.env.MUX_PRIVATE_KEY) {
        return res.status(503).json({ message: 'Mux signed playback is not configured' });
      }
      const client = getMuxClient();
      muxTokens = await client.jwt.signPlaybackId(movie.muxPlaybackId, {
        type: ['playback', 'thumbnail', 'storyboard'],
        expiration: '2h'
      });
    }

    movie.views += 1;
    await movie.save();

    await User.findByIdAndUpdate(req.user._id, {
      $push: { watchHistory: { movie: movie._id, watchedAt: new Date() } }
    });

    if (movie.muxPlaybackId) {
      return res.json({ playbackId: movie.muxPlaybackId, tokens: muxTokens, expiresInSeconds: 7200 });
    }

    if (movie.videoProvider === 'terabox') {
      return res.json({ provider: 'terabox', streamUrl: movie.videoUrl, expiresInSeconds: 3600 });
    }

    // Keep previously added direct video URLs playable during migration.
    res.json({ streamUrl: movie.videoUrl, expiresInSeconds: 3600 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/movies/:id/terabox/playlist
const streamTeraBoxPlaylist = async (req, res) => {
  try {
    const movie = await getMovieForTeraBoxStream(req, res);
    if (!movie) return;
    const { manifest, baseUrl } = await getTeraBoxManifest(movie);
    const rewritten = rewriteTeraBoxManifest(req, movie._id, manifest, baseUrl);
    res
      .type('application/vnd.apple.mpegurl')
      .set('Cache-Control', 'private, no-store')
      .send(rewritten);
  } catch (err) {
    res.status(err.status || 502).json({ message: err.message || 'Unable to load the TeraBox stream' });
  }
};

// @route GET /api/movies/:id/terabox/segment?target=...
const streamTeraBoxSegment = async (req, res) => {
  try {
    const movie = await getMovieForTeraBoxStream(req, res);
    if (!movie) return;
    const target = req.query.target;
    if (typeof target !== 'string' || !isTeraBoxCdnUrl(target)) {
      return res.status(400).json({ message: 'Invalid TeraBox stream segment URL' });
    }

    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(target, { headers });
    res.status(upstream.status);
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(name);
      if (value) res.set(name, value);
    }
    res.set('Cache-Control', 'private, no-store');
    if (!upstream.body) return res.end();
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('mpegurl')) {
      res.removeHeader('content-length');
      const manifest = await upstream.text();
      const rewritten = rewriteTeraBoxManifest(req, movie._id, manifest, upstream.url);
      return res.type('application/vnd.apple.mpegurl').send(rewritten);
    }
    Readable.fromWeb(upstream.body).on('error', (err) => res.destroy(err)).pipe(res);
  } catch (err) {
    res.status(502).json({ message: err.message || 'Unable to load a TeraBox video segment' });
  }
};

// @route GET /api/movies/:id/download
const downloadMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    if (!movie.allowDownload) {
      return res.status(403).json({ message: 'Downloads are not enabled for this title' });
    }
    if (!movie.downloadUrl) {
      return res.status(404).json({ message: 'No download link is configured for this title' });
    }

    movie.downloads += 1;
    await movie.save();

    // This may be a direct file URL or a provider share page such as TeraBox.
    res.json({ downloadUrl: movie.downloadUrl, expiresInSeconds: 900 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route POST /api/movies/:id/watchlist
const toggleWatchlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const idx = user.watchlist.findIndex((m) => m.toString() === req.params.id);

    if (idx === -1) {
      user.watchlist.push(req.params.id);
    } else {
      user.watchlist.splice(idx, 1);
    }

    await user.save();
    res.json({ watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  listMovies,
  getMovie,
  streamMovie,
  streamTeraBoxPlaylist,
  streamTeraBoxSegment,
  downloadMovie,
  toggleWatchlist
};
