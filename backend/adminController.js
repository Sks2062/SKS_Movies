const fs = require('fs/promises');
const Movie = require('./Movie');
const User = require('./User');
const {
  uploadVideoFile,
  remoteUploadVideo,
  getRemoteStatus,
  getFileInfo,
  listFolders: getMixDropFolders
} = require('./mixdropClient');
const streamtape = require('./streamtapeClient');

const isHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const getMixDropEmbedUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^\/e\/[a-z0-9_-]+\/?$/i.test(url.pathname)
      ? url.href
      : '';
  } catch {
    return '';
  }
};

const getStreamtapeEmbedUrl = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const id = url.pathname.match(/^\/(?:e|v)\/([a-z0-9_-]+)(?:\/[^/]*)?\/?$/i)?.[1];
    return url.protocol === 'https:' && /(^|\.)streamtape\.com$/.test(host) && id
      ? `https://streamtape.com/e/${id}`
      : '';
  } catch { return ''; }
};

const getStreamtapeId = (value) => getStreamtapeEmbedUrl(value).match(/\/e\/([^/]+)/)?.[1] || '';

const getStreamtapeFileId = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol !== 'https:' || !/(^|\.)streamtape\.com$/.test(host)) return '';
    return url.pathname.match(/^\/(?:e|v)\/([a-z0-9_-]+)(?:\/[^/]*)?\/?$/i)?.[1] || '';
  } catch { return ''; }
};

const getDailymotionEmbedUrl = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol !== 'https:' || !['dai.ly', 'dailymotion.com', 'geo.dailymotion.com'].includes(host)) return '';
    const id = host === 'dai.ly'
      ? url.pathname.match(/^\/([a-z0-9_-]+)\/?$/i)?.[1]
      : url.pathname.match(/^\/(?:video|embed\/video)\/([a-z0-9_-]+)(?:_[^/]*)?\/?$/i)?.[1]
        || (host === 'geo.dailymotion.com' && url.pathname.match(/^\/player(?:\/[^/]+)?\.html$/i) ? url.searchParams.get('video') : '');
    return id && /^[a-z0-9_-]+$/i.test(id)
      ? `https://geo.dailymotion.com/player.html?video=${encodeURIComponent(id)}`
      : '';
  } catch { return ''; }
};

const isUserProvidedMixDropEmbed = (value) => {
  const embedUrl = getMixDropEmbedUrl(value);
  if (!embedUrl) return false;
  const hostname = new URL(embedUrl).hostname.toLowerCase().replace(/^www\./, '');
  return /^mixdrop\.[a-z]{2,}$/.test(hostname);
};

const toList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
};

const isVideoFile = (file) => {
  if (!file) return false;
  const videoExtensions = /\.(mp4|m4v|mkv|mov|avi|webm|mpeg|mpg|3gp)$/i;
  return file.mimetype?.startsWith('video/') || videoExtensions.test(file.originalname || '');
};

// @route GET /api/admin/movies
const listMovies = async (req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/admin/mixdrop/folders
const listMixDropFolders = async (req, res) => {
  try {
    const result = await getMixDropFolders();
    res.json((result?.folders || []).map(({ id, title }) => ({ id: String(id), title })));
  } catch (err) {
    res.status(err.status || 502).json({ message: err.message || 'Unable to load MixDrop folders.' });
  }
};

const listStreamtapeFolders = async (req, res) => {
  try {
    const folders = await streamtape.getFolders();
    res.json(folders.map(({ id, name }) => ({ id: String(id), title: name })));
  } catch (err) {
    res.status(err.status || 502).json({ message: err.message || 'Unable to load Streamtape folders.' });
  }
};

// @route POST /api/admin/movies
const addMovie = async (req, res) => {
  let tempFile;
  try {
    const provider = ['mixdrop', 'streamtape', 'dailymotion'].includes(req.body.videoProvider)
      ? req.body.videoProvider
      : 'mixdrop';
    const importMode = req.body.importMode || 'file';
    const isRemoteImport = importMode === 'remote';
    const isExistingEmbed = importMode === 'embed';
    tempFile = req.file?.path;
    if (isRemoteImport && !isHttpsUrl(req.body.sourceUrl)) {
      return res.status(400).json({ message: 'Use a public HTTPS direct-download URL for remote upload.' });
    }
    if (!isRemoteImport && !isVideoFile(req.file)) {
      if (!isExistingEmbed) return res.status(400).json({ message: 'Choose a supported video file to upload.' });
    }
    const validEmbed = provider === 'streamtape'
      ? getStreamtapeEmbedUrl(req.body.embedUrl)
      : provider === 'dailymotion'
        ? getDailymotionEmbedUrl(req.body.embedUrl)
        : isUserProvidedMixDropEmbed(req.body.embedUrl);
    if (isExistingEmbed && !validEmbed) {
      return res.status(400).json({ message: provider === 'streamtape'
        ? 'Paste a valid HTTPS Streamtape player link, such as https://streamtape.com/e/FILE_ID.'
        : provider === 'dailymotion'
          ? 'Paste a valid Dailymotion video link, such as https://dai.ly/VIDEO_ID.'
          : 'Paste a valid HTTPS MixDrop embed link, such as https://mixdrop.top/e/FILE_ID.' });
    }
    if (!req.body.title?.trim() || !req.body.description?.trim()) {
      return res.status(400).json({ message: 'Movie title and description are required.' });
    }
    if (provider === 'dailymotion') {
      if (!isExistingEmbed) return res.status(400).json({ message: 'For Dailymotion, choose “Use an existing player link”.' });
      const streamtapeFileId = getStreamtapeFileId(req.body.streamtapeDownloadUrl);
      if (req.body.streamtapeDownloadUrl && !streamtapeFileId) {
        return res.status(400).json({ message: 'Paste a valid Streamtape /e/ or /v/ link for downloads.' });
      }
      if (req.body.allowDownload === 'true' && !streamtapeFileId && !req.body.downloadUrl) {
        return res.status(400).json({ message: 'Add a Streamtape download link before enabling downloads.' });
      }
      const movie = await Movie.create({
        title: req.body.title,
        description: req.body.description,
        genre: toList(req.body.genre),
        releaseYear: Number(req.body.releaseYear),
        duration: req.body.duration ? Number(req.body.duration) : undefined,
        cast: toList(req.body.cast),
        posterUrl: req.body.posterUrl,
        videoProvider: 'dailymotion',
        videoUrl: getDailymotionEmbedUrl(req.body.embedUrl),
        streamtapeFileId,
        streamtapeStatus: streamtapeFileId ? 'Ready' : '',
        downloadUrl: req.body.downloadUrl || '',
        allowStreaming: req.body.allowStreaming !== 'false',
        allowDownload: req.body.allowDownload === 'true',
        uploadedBy: req.user._id
      });
      return res.status(201).json({ movie });
    }

    if (provider === 'streamtape') {
      const uploaded = isExistingEmbed
        ? { fileId: getStreamtapeId(req.body.embedUrl), status: 'Ready' }
        : isRemoteImport
          ? await streamtape.remoteUploadVideo(req.body.sourceUrl, req.body.title, req.body.folder)
          : await streamtape.uploadVideoFile(req.file, req.body.folder);
      const remoteId = isRemoteImport ? String(uploaded?.id || '') : '';
      const fileId = uploaded?.fileId || uploaded?.linkid || (isRemoteImport ? '' : uploaded?.id) || '';
      const embedUrl = fileId ? `https://streamtape.com/e/${encodeURIComponent(fileId)}` : '';
      if (isExistingEmbed && !embedUrl) return res.status(400).json({ message: 'Could not read the Streamtape file ID from that link.' });
      if (!isExistingEmbed && isRemoteImport && !remoteId) return res.status(502).json({ message: 'Streamtape did not return a remote upload ID.' });
      if (!isExistingEmbed && !isRemoteImport && !embedUrl) return res.status(502).json({ message: 'Streamtape uploaded the file but did not return a player ID. Refresh the file listing and try again.' });

      const movie = await Movie.create({
        title: req.body.title,
        description: req.body.description,
        genre: toList(req.body.genre),
        releaseYear: Number(req.body.releaseYear),
        duration: req.body.duration ? Number(req.body.duration) : undefined,
        cast: toList(req.body.cast),
        posterUrl: req.body.posterUrl,
        videoProvider: 'streamtape',
        videoUrl: embedUrl,
        streamtapeFileId: String(fileId),
        streamtapeRemoteId: remoteId,
        streamtapeStatus: isExistingEmbed ? 'Ready' : (isRemoteImport ? 'Queued' : (uploaded.status || 'Uploaded')),
        downloadUrl: req.body.downloadUrl || '',
        allowStreaming: req.body.allowStreaming !== 'false',
        allowDownload: req.body.allowDownload === 'true',
        uploadedBy: req.user._id
      });
      return res.status(201).json({ movie });
    }

    const uploadedFile = isExistingEmbed
      ? { embedurl: req.body.embedUrl }
      : isRemoteImport
        ? await remoteUploadVideo(req.body.sourceUrl, req.body.title, req.body.folder)
        : await uploadVideoFile(req.file, req.body.folder);
    const embedUrl = isExistingEmbed
      ? getMixDropEmbedUrl(uploadedFile.embedurl)
      : getMixDropEmbedUrl(uploadedFile?.embedurl);
    if (isExistingEmbed ? !embedUrl : (isRemoteImport ? !uploadedFile?.id : (!uploadedFile?.fileref || !embedUrl))) {
      return res.status(502).json({ message: 'MixDrop did not return the expected upload reference.' });
    }

    const movie = await Movie.create({
      title: req.body.title,
      description: req.body.description,
      genre: toList(req.body.genre),
      releaseYear: Number(req.body.releaseYear),
      duration: req.body.duration ? Number(req.body.duration) : undefined,
      cast: toList(req.body.cast),
      posterUrl: req.body.posterUrl,
      videoProvider: 'mixdrop',
      videoUrl: embedUrl,
      mixdropRemoteId: isRemoteImport ? String(uploadedFile.id) : '',
      mixdropFileRef: !isExistingEmbed && uploadedFile.fileref ? String(uploadedFile.fileref) : '',
      mixdropStatus: isExistingEmbed ? 'Ready' : (isRemoteImport ? (uploadedFile.fileref ? 'Processing' : 'Queued') : 'Uploaded'),
      downloadUrl: req.body.downloadUrl || '',
      allowStreaming: req.body.allowStreaming !== 'false',
      allowDownload: req.body.allowDownload === 'true',
      uploadedBy: req.user._id
    });
    res.status(201).json({ movie });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  } finally {
    if (tempFile) await fs.rm(tempFile, { force: true }).catch(() => {});
  }
};

const refreshStreamtapeStatus = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    if (!movie.streamtapeRemoteId) return res.status(400).json({ message: 'This movie has no pending Streamtape import.' });
    const remoteResult = await streamtape.getRemoteStatus(movie.streamtapeRemoteId);
    const remote = remoteResult?.[movie.streamtapeRemoteId] || Object.values(remoteResult || {})[0];
    if (!remote) return res.status(404).json({ message: 'Streamtape could not find this import.' });
    let fileId = remote.extid && typeof remote.extid === 'string' ? remote.extid : '';
    if (!fileId && remote.url && typeof remote.url === 'string') fileId = getStreamtapeId(remote.url);
    if (!fileId) {
      const listing = await streamtape.listFolder(remote.folderid || '');
      const match = (listing?.files || []).find((file) => file.name === movie.title || file.name.startsWith(movie.title));
      fileId = match?.linkid || '';
    }
    movie.streamtapeStatus = remote.status || movie.streamtapeStatus;
    if (fileId) {
      movie.streamtapeFileId = fileId;
      movie.videoUrl = `https://streamtape.com/e/${encodeURIComponent(fileId)}`;
      movie.streamtapeStatus = 'Ready';
    }
    await movie.save();
    res.json({ status: movie.streamtapeStatus, ready: Boolean(movie.videoUrl), embedUrl: movie.videoUrl });
  } catch (err) {
    res.status(err.status || 502).json({ message: err.message || 'Unable to check Streamtape import status.' });
  }
};

// @route POST /api/admin/movies/:id/mixdrop-status
const refreshMixDropStatus = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    let remoteInfo = null;
    if (movie.mixdropRemoteId) {
      remoteInfo = await getRemoteStatus(movie.mixdropRemoteId);
      if (remoteInfo?.fileref) movie.mixdropFileRef = remoteInfo.fileref;
    }
    const fileInfo = movie.mixdropFileRef ? await getFileInfo(movie.mixdropFileRef) : null;
    if (!remoteInfo && !fileInfo) return res.status(404).json({ message: 'MixDrop could not find this uploaded file.' });
    movie.mixdropStatus = fileInfo?.status || remoteInfo?.status || movie.mixdropStatus;
    movie.videoUrl = getMixDropEmbedUrl(fileInfo?.embedurl || remoteInfo?.embedurl) || movie.videoUrl;
    await movie.save();
    res.json({
      status: movie.mixdropStatus,
      ready: Boolean(movie.videoUrl),
      embedUrl: movie.videoUrl
    });
  } catch (err) {
    res.status(err.status || 502).json({ message: err.message || 'Unable to check MixDrop import status.' });
  }
};

// @route PUT /api/admin/movies/:id
const updateMovie = async (req, res) => {
  try {
    const updates = { ...req.body };
    let dailymotionEmbedUrl = '';
    if (Object.hasOwn(updates, 'dailymotionUrl')) {
      dailymotionEmbedUrl = getDailymotionEmbedUrl(updates.dailymotionUrl);
      if (!dailymotionEmbedUrl) return res.status(400).json({ message: 'Paste a valid Dailymotion video link, such as https://dai.ly/VIDEO_ID.' });
      delete updates.dailymotionUrl;
    }
    delete updates.videoProvider;
    delete updates.videoUrl;
    if (dailymotionEmbedUrl) {
      updates.videoProvider = 'dailymotion';
      updates.videoUrl = dailymotionEmbedUrl;
    }
    if (Object.hasOwn(updates, 'streamtapeDownloadUrl')) {
      const fileId = getStreamtapeFileId(updates.streamtapeDownloadUrl);
      if (updates.streamtapeDownloadUrl && !fileId) return res.status(400).json({ message: 'Paste a valid Streamtape /e/ or /v/ link.' });
      updates.streamtapeFileId = fileId;
      updates.streamtapeStatus = fileId ? 'Ready' : '';
      delete updates.streamtapeDownloadUrl;
    }
    const movie = await Movie.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    res.json(movie);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route DELETE /api/admin/movies/:id
const deleteMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    await Movie.findByIdAndDelete(movie._id);
    res.json({ message: 'Movie deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/admin/users
const listUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const [userCount, movieCount, totals] = await Promise.all([
      User.countDocuments(),
      Movie.countDocuments(),
      Movie.aggregate([
        { $group: { _id: null, totalViews: { $sum: '$views' }, totalDownloads: { $sum: '$downloads' } } }
      ])
    ]);

    res.json({
      userCount,
      movieCount,
      totalViews: totals[0]?.totalViews || 0,
      totalDownloads: totals[0]?.totalDownloads || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { listMovies, listMixDropFolders, listStreamtapeFolders, addMovie, refreshMixDropStatus, refreshStreamtapeStatus, updateMovie, deleteMovie, listUsers, getStats };
