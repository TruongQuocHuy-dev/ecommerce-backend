const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        value: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        description: {
            type: String,
            default: '',
        },
        isPublic: {
            type: Boolean,
            default: false,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

// Static method to get a setting by key
settingSchema.statics.getByKey = async function (key) {
    const setting = await this.findOne({ key }).lean();
    return setting ? setting.value : null;
};

// Static method to set a setting by key (upsert)
settingSchema.statics.setByKey = async function (key, value, userId, options = {}) {
    const setting = await this.findOneAndUpdate(
        { key },
        {
            $set: {
                value,
                updatedBy: userId,
                ...(options.description && { description: options.description }),
                ...(options.isPublic !== undefined && { isPublic: options.isPublic }),
            },
        },
        { new: true, upsert: true, runValidators: true }
    );
    return setting;
};

module.exports = mongoose.model('Setting', settingSchema);
