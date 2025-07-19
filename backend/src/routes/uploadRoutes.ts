import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
const logosDir = path.join(uploadsDir, 'logos');
const signaturesDir = path.join(uploadsDir, 'signatures');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

if (!fs.existsSync(signaturesDir)) {
  fs.mkdirSync(signaturesDir, { recursive: true });
}

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logosDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?._id;
    const ext = path.extname(file.originalname);
    const filename = `logo-${userId}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, svg, webp)'));
    }
  }
});

// Upload logo endpoint
router.post('/logo', authenticate, logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Delete old logo if exists
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (user.logo) {
      const oldLogoPath = path.join(process.cwd(), user.logo);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    // Return the relative path for storing in database
    const logoPath = `uploads/logos/${req.file.filename}`;

    // Update user profile with new logo path
    const User = require('../models/User').default;
    await User.findByIdAndUpdate(user._id, { logo: logoPath });

    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        logoPath,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });

  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload logo'
    });
  }
});

// Note: File serving is now handled by express.static middleware in main app

// Delete logo endpoint
router.delete('/logo', authenticate, async (req, res) => {
  try {
    const User = require('../models/User').default;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get user from database to get current logo
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.logo) {
      return res.status(400).json({
        success: false,
        message: 'No logo to delete'
      });
    }

    // Delete file from filesystem
    const logoPath = path.join(process.cwd(), user.logo);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }

    // Update user profile to remove logo reference
    await User.findByIdAndUpdate(userId, { $unset: { logo: 1 } });

    res.status(200).json({
      success: true,
      message: 'Logo deleted successfully'
    });

  } catch (error) {
    console.error('Logo delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete logo'
    });
  }
});

// Configure multer for signature uploads
const signatureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, signaturesDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?._id;
    const ext = path.extname(file.originalname);
    const filename = `signature-${userId}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const signatureUpload = multer({
  storage: signatureStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, svg, webp)'));
    }
  }
});

// Upload signature endpoint
router.post('/signature', authenticate, signatureUpload.single('signature'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Delete old signature if exists
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (user.signature) {
      const oldSignaturePath = path.join(process.cwd(), user.signature);
      if (fs.existsSync(oldSignaturePath)) {
        fs.unlinkSync(oldSignaturePath);
      }
    }

    // Return the relative path for storing in database
    const signaturePath = `uploads/signatures/${req.file.filename}`;

    // Update user profile with new signature path
    const User = require('../models/User').default;
    await User.findByIdAndUpdate(user._id, { signature: signaturePath });

    res.status(200).json({
      success: true,
      message: 'Signature uploaded successfully',
      data: {
        signaturePath,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });

  } catch (error) {
    console.error('Signature upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload signature'
    });
  }
});

// Delete signature endpoint
router.delete('/signature', authenticate, async (req, res) => {
  try {
    const User = require('../models/User').default;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get user from database to get current signature
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.signature) {
      return res.status(400).json({
        success: false,
        message: 'No signature to delete'
      });
    }

    // Delete file from filesystem
    const signaturePath = path.join(process.cwd(), user.signature);
    if (fs.existsSync(signaturePath)) {
      fs.unlinkSync(signaturePath);
    }

    // Update user profile to remove signature reference
    await User.findByIdAndUpdate(userId, { $unset: { signature: 1 } });

    res.status(200).json({
      success: true,
      message: 'Signature deleted successfully'
    });

  } catch (error) {
    console.error('Signature delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete signature'
    });
  }
});

export default router;
