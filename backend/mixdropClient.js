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

const request = async (endpoint, params) => {
  const credentials = getCredentials();
  const url = new URL(endpoint);
  url.searchParams.set('email', credentials.email);
  url.searchParams.set('key', credentials.key);
  Object.entries(params).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(name, item));
    else if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, value);
  });

  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    throw Object.assign(new Error('MixDrop API request failed. Try again later.'), { status: 502 });
  }
  const payload = await response.json();
  if (!payload.success) {
    throw Object.assign(new Error(payload.message || 'MixDrop rejected the request. Check the source URL and API credentials.'), { status: 502 });
  }
  return payload.result;
};

const queueRemoteUpload = (sourceUrl, name) => request('https://api.mixdrop.ag/remoteupload', {
  url: sourceUrl,
  name
});

const getRemoteStatus = (id) => request('https://api.mixdrop.ag/remotestatus', { id });

const getFileInfo = async (fileref) => {
  const result = await request('https://api.mixdrop.ag/fileinfo2', { 'ref[]': [fileref] });
  return result?.[fileref] || null;
};

module.exports = { queueRemoteUpload, getRemoteStatus, getFileInfo };
