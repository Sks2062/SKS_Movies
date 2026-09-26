const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    posterUrl: { type: String, default: '' },
    videoUrl: { type: String, default: '' }, // Provider player embed URL.
    videoProvider: { type: String, enum: ['mixdrop', 'streamtape', 'dailymotion'], default: 'mixdrop' },
    mixdropRemoteId: { type: String, default: '' },
    mixdropFileRef: { type: String, default: '' },
    mixdropStatus: { type: String, default: 'queued' },
    streamtapeFileId: { type: String, default: '' },
    streamtapeRemoteId: { type: String, default: '' },
    streamtapeStatus: { type: String, default: '' },
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
