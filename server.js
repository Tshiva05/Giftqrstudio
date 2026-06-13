// Import required modules
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and serve static frontend files from 'public' directory
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for local temporary storage before Cloudinary upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        // Create uploads folder if it doesn't exist
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Multer for audio — MP3 only, max 10 MB
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const audioUpload = multer({
    storage: audioStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['audio/mpeg', 'audio/mp3'];
        if (allowed.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.mp3')) {
            cb(null, true);
        } else {
            cb(new Error('Only MP3 files are allowed.'));
        }
    }
});

// POST route to handle media uploads
app.post('/upload', upload.single('media'), async (req, res) => {
    try {
        // Check if file was received
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        // Upload local file to Cloudinary
        // resource_type 'auto' allows Cloudinary to handle images, videos, and raw files seamlessly
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: "auto",
            folder: "giftqr_studio"
        });

        // Delete the temporary file from the local 'uploads' directory to save space
        fs.unlinkSync(req.file.path);

        // Return successful JSON response with permanent Cloudinary URL
        res.json({
            success: true,
            url: result.secure_url
        });

    } catch (error) {
        console.error('Upload Error:', error);
        // Attempt to clean up temp file even if Cloudinary upload fails
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: 'Server error during upload.' });
    }
});

// POST route to handle background music (MP3) uploads
app.post('/upload-audio', audioUpload.single('music'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No audio file uploaded.' });
        }

        // Upload to Cloudinary using video resource_type (required for audio on Cloudinary)
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: "video",
            folder: "giftqr_studio_music",
            format: "mp3"
        });

        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            url: result.secure_url
        });

    } catch (error) {
        console.error('Audio Upload Error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        // Handle multer fileFilter errors
        if (error.message && error.message.includes('Only MP3')) {
            return res.status(400).json({ success: false, message: 'Only MP3 files are allowed.' });
        }
        res.status(500).json({ success: false, message: 'Server error during audio upload.' });
    }
});


app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        success: false,
        message: err.message || 'Server Error'
    });
});