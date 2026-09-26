const fs = require('fs');
const crypto = require('crypto');
const FormData = require('form-data');

const credentials = () => {
  const login = process.env.STREAMTAPE_LOGIN;
  const key = process.env.STREAMTAPE_KEY;
  if (!login || !key) {
    throw Object.assign(new Error('Streamtape is not configured. Set STREAMTAPE_LOGIN and STREAMTAPE_KEY on the server.'), { status: 503 });
  }
  return { login, key };
};

const parse = async (response) => {
  let payload;
  try { payload = await response.json(); } catch {
    throw Object.assign(new Error('Streamtape returned an unreadable response.'), { status: 502 });
  }
  if (!response.ok || payload.status !== 200) {
    throw Object.assign(new Error(payload.msg || 'Streamtape rejected the request. Check the API credentials and video.'), { status: 502 });
  }
  return payload.result;
};

const request = async (path, params = {}) => {
  const url = new URL(`https://api.streamtape.com${path}`);
  const auth = credentials();
  Object.entries({ ...auth, ...params }).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  return parse(response);
};

const hashFile = (path) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(path);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(hash.digest('hex')));
});

const uploadVideoFile = async (file, folder) => {
  const sha256 = await hashFile(file.path);
  const uploadInfo = await request('/file/ul', { folder, sha256 });
  if (!uploadInfo?.url) throw Object.assign(new Error('Streamtape did not return an upload URL.'), { status: 502 });

  const form = new FormData();
  form.append('file1', fs.createReadStream(file.path), {
    filename: (file.originalname || 'video').replace(/[\r\n"]/g, '_'),
    contentType: file.mimetype || 'application/octet-stream'
  });
  const contentLength = await new Promise((resolve, reject) => form.getLength((error, length) => error ? reject(error) : resolve(length)));
  const response = await fetch(uploadInfo.url, {
    method: 'POST',
    headers: { ...form.getHeaders(), 'content-length': String(contentLength) },
    body: form,
    duplex: 'half',
    signal: AbortSignal.timeout(Number(process.env.STREAMTAPE_UPLOAD_TIMEOUT_MS) || 60 * 60 * 1000)
  });
  const uploadResult = await parse(response);
  const fileId = uploadResult?.fileid || uploadResult?.fileId || uploadResult?.id || uploadResult?.linkid;
  if (fileId) return { fileId: String(fileId), status: 'Uploaded' };

  // Streamtape's upload endpoint can return only `result: true`; resolve the
  // uploaded file from the destination folder using its original filename.
  const listing = await listFolder(folder);
  const matchingFile = (listing?.files || []).filter((item) => item.name === file.originalname)
    .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))[0];
  if (!matchingFile?.linkid) throw Object.assign(new Error('Upload completed, but Streamtape has not listed the new file yet. Refresh the movie status shortly.'), { status: 502 });
  return { fileId: String(matchingFile.linkid), status: matchingFile.convert || 'Uploaded' };
};

const remoteUploadVideo = (sourceUrl, name, folder) => request('/remotedl/add', { url: sourceUrl, name, folder });
const getRemoteStatus = (id) => request('/remotedl/status', { id });
const listFolder = (folder) => request('/file/listfolder', { folder });
const getFolders = async () => (await listFolder()).folders || [];

module.exports = { uploadVideoFile, remoteUploadVideo, getRemoteStatus, listFolder, getFolders };
