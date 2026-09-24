const mongoose = require('mongoose');
const Movie = require('./Movie');
const { getMuxClient } = require('./muxClient');

const muxWebhook = async (req, res) => {
  try {
    if (!process.env.MUX_WEBHOOK_SECRET) {
      return res.status(503).json({ message: 'Mux webhook verification is not configured' });
    }

    const mux = getMuxClient();
    const event = await mux.webhooks.unwrap(req.body.toString('utf8'), req.headers);
    const asset = event.data;

    if (event.type === 'video.asset.ready' || event.type === 'video.asset.errored') {
      if (asset.passthrough && mongoose.isValidObjectId(asset.passthrough)) {
        const signedPlayback = asset.playback_ids?.find((item) => item.policy === 'signed');
        await Movie.findByIdAndUpdate(asset.passthrough, {
          muxAssetId: asset.id,
          muxPlaybackId: signedPlayback?.id || '',
          muxStatus: event.type === 'video.asset.ready' && signedPlayback ? 'ready' : 'error',
          ...(asset.duration ? { duration: Math.round(asset.duration / 60) } : {})
        });
      }
    } else if (event.type === 'video.upload.asset_created') {
      await Movie.findOneAndUpdate(
        { muxUploadId: asset.id },
        { muxAssetId: asset.asset_id, muxStatus: 'processing' }
      );
    } else if (event.type === 'video.upload.errored') {
      await Movie.findOneAndUpdate({ muxUploadId: asset.id }, { muxStatus: 'error' });
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ message: `Invalid Mux webhook: ${err.message}` });
  }
};

module.exports = { muxWebhook };
