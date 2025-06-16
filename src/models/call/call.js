const mongoose = require("mongoose");

const CallSchema = new mongoose.Schema(
  {
    caller: {
      id: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'caller.type' },
      type: { type: String, required: true, enum: ['User', 'Expert'] },
    },

    receiver: {
      id: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'receiver.type' },
      type: { type: String, required: true, enum: ['User', 'Expert'] },
    },

    callType: { type: String, enum: ['audio', 'video'], required: true },

    startedAt: { type: Date },

    endedAt: { type: Date },

    duration: { type: Number, default: 0 }, // Duration in seconds

    status: { type: String, enum: ['started', 'ongoing', 'ended', 'missed'], default: 'started' },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Call", CallSchema);
