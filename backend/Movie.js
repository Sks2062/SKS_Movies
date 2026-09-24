const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    posterUrl: { type: String, required: true },
    videoUrl: { type: String, default: '' }, // Legacy external URL; new uploads use Mux.
    muxAssetId: { type: String, default: '' },
    muxUploadId: { type: String, default: '' },
    muxPlaybackId: { type: String, default: '' },
    muxStatus: {
      type: String,
      enum: ['pending_upload', 'processing', 'ready', 'error'],
      default: 'ready'
    },
    downloadUrl: { type: String, trim: true, default: '' },
    genre: [{ type: String }],
    releaseYear: { type: Number, required: true },
    duration: { type: Number }, // minutes
    cast: [{ type: String }],

    allowStreaming: { type: Boolean, default: true },
    allowDownload: { type: Boolean, default: false },

    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

movieSchema.index({ title: 'text', description: 'text', genre: 'text' });

module.exports = mongoose.model('Movie', movieSchema);
