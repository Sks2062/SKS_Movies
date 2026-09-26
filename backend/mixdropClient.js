const fs = require('fs');
const FormData = require('form-data');

const getCredentials = () => {
  const email = process.env.MIXDROP_API_EMAIL;
  const key = process.env.MIXDROP_API_KEY;
  if (!email || !key) {
    throw Object.assign(
      new Error('MixDrop API is not configured. Set MIXDROP_API_EMAIL and MIXDROP_API_KEY on the server.'),
      { status: 503 }
    );
  }
  return { email, key };
};

const parseResponse = async (response) => {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw Object.assign(new Error('MixDrop returned an unreadable response.'), { status: 502 });
  }
  if (!response.ok || !payload.success) {
    throw Object.assign(
      new Error(payload.message || 'MixDrop rejected the request. Check the API credentials and video file.'),
      { status: 502 }
    );
  }
  return payload.result;
};

const request = async (endpoint, params = {}) => {
  const { email, key } = getCredentials();
  const url = new URL(endpoint);
  url.searchParams.set('email', email);
  url.searchParams.set('key', key);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, value);
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  return parseResponse(response);
};

const uploadVideoFile = async (file, folder) => {
  const { email, key } = getCredentials();
  const form = new FormData();
  const filename = (file.originalname || 'video').replace(/[\r\n"]/g, '_');
  form.append('email', email);
  form.append('key', key);
  if (folder) form.append('folder', folder);
  form.append('file', fs.createReadStream(file.path), {
    filename,
    contentType: file.mimetype || 'application/octet-stream'
  });

  const contentLength = await new Promise((resolve, reject) => {
    form.getLength((error, length) => error ? reject(error) : resolve(length));
  });
  const response = await fetch('https://ul.mixdrop.ag/api', {
    method: 'POST',
    headers: { ...form.getHeaders(), 'content-length': String(contentLength) },
    body: form,
    duplex: 'half',
    signal: AbortSignal.timeout(Number(process.env.MIXDROP_UPLOAD_TIMEOUT_MS) || 60 * 60 * 1000)
  });
  return parseResponse(response);
};

const remoteUploadVideo = (sourceUrl, name, folder) => request('https://api.mixdrop.ag/remoteupload', {
  url: sourceUrl,
  name,
  folder
});

const getRemoteStatus = (id) => request('https://api.mixdrop.ag/remotestatus', { id });

const listFolders = (parent) => request('https://api.mixdrop.ag/folderlist', { id: parent });

const getFileInfo = async (fileref) => {
  const { email, key } = getCredentials();
  const url = new URL('https://api.mixdrop.ag/fileinfo2');
  url.searchParams.set('email', email);
  url.searchParams.set('key', key);
  url.searchParams.append('ref[]', fileref);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const result = await parseResponse(response);
  return result?.[fileref] || null;
};

module.exports = { uploadVideoFile, remoteUploadVideo, getRemoteStatus, getFileInfo, listFolders };
