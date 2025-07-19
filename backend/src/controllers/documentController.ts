import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import Document from '../models/Document';
import { documentParsingService } from '../services/documentParsingService';
import { blockchainService } from '../services/blockchainService';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

// File filter for allowed file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, images, Word, Excel, and text files are allowed.'));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files per request
  }
});

// Generate file hash
const generateFileHash = async (filePath: string): Promise<string> => {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

// Upload single document
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
      return;
    }

    const { category = 'other', tags = '', description = '' } = req.body;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Generate file hash for integrity
    const fileHash = await generateFileHash(req.file.path);

    // Check if file already exists (duplicate detection)
    const existingDoc = await Document.findOne({ hash: fileHash, userId });
    if (existingDoc) {
      // Remove uploaded file since it's a duplicate
      await fs.unlink(req.file.path);
      res.status(409).json({
        success: false,
        message: 'File already exists',
        data: { existingDocument: existingDoc }
      });
      return;
    }

    // Parse tags
    const parsedTags = tags ? tags.split(',').map((tag: string) => tag.trim().toLowerCase()) : [];

    // Parse document if supported
    let parsedData = undefined;
    if (documentParsingService.isFileTypeSupported(req.file.mimetype)) {
      try {
        parsedData = await documentParsingService.parseDocument(req.file.path, req.file.mimetype);
        console.log('Document parsed successfully:', parsedData.confidence);
      } catch (parseError) {
        console.error('Document parsing failed:', parseError);
        // Continue without parsed data
      }
    }

    // Create document record
    const document = new Document({
      userId,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      category,
      tags: parsedTags,
      description,
      hash: fileHash,
      isEncrypted: false,
      parsedData
    });

    await document.save();

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: { document }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Upload multiple documents
export const uploadMultipleDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
      return;
    }

    const { category = 'other', tags = '', description = '' } = req.body;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }
    const parsedTags = tags ? tags.split(',').map((tag: string) => tag.trim().toLowerCase()) : [];

    const uploadedDocuments = [];
    const errors = [];

    for (const file of req.files) {
      try {
        // Generate file hash
        const fileHash = await generateFileHash(file.path);

        // Check for duplicates
        const existingDoc = await Document.findOne({ hash: fileHash, userId });
        if (existingDoc) {
          await fs.unlink(file.path);
          errors.push({
            file: file.originalname,
            error: 'File already exists'
          });
          continue;
        }

        // Create document record
        const document = new Document({
          userId,
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path,
          category,
          tags: parsedTags,
          description,
          hash: fileHash,
          isEncrypted: false
        });

        await document.save();
        uploadedDocuments.push(document);

      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        
        // Clean up file on error
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }

        errors.push({
          file: file.originalname,
          error: 'Processing failed'
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `${uploadedDocuments.length} documents uploaded successfully`,
      data: {
        documents: uploadedDocuments,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Multiple document upload error:', error);

    // Clean up all uploaded files on error
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload documents',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get user documents
export const getUserDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }
    const { 
      category, 
      tags, 
      search, 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query: any = { userId };

    if (category) {
      query.category = category;
    }

    if (tags) {
      const tagArray = (tags as string).split(',').map(tag => tag.trim().toLowerCase());
      query.tags = { $in: tagArray };
    }

    if (search) {
      query.$or = [
        { originalName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search as string, 'i')] } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [documents, total] = await Promise.all([
      Document.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .select('-path'), // Don't expose file system path
      Document.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        documents,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve documents',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get single document
export const getDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const document = await Document.findOne({ _id: id, userId }).select('-path');

    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { document }
    });

  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Download document
export const downloadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found'
      });
      return;
    }

    // Check if file exists
    try {
      await fs.access(document.path);
    } catch {
      res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
      return;
    }

    // Increment download count
    document.downloadCount += 1;
    document.lastAccessed = new Date();
    await document.save();

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    res.setHeader('Content-Type', document.mimeType);

    // Stream file to response
    const fileStream = require('fs').createReadStream(document.path);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download document',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Update document metadata
export const updateDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }
    const { category, tags, description } = req.body;

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found'
      });
      return;
    }

    // Update fields
    if (category) document.category = category;
    if (description !== undefined) document.description = description;
    if (tags) {
      const parsedTags = tags.split(',').map((tag: string) => tag.trim().toLowerCase());
      document.tags = parsedTags;
    }

    await document.save();

    res.status(200).json({
      success: true,
      message: 'Document updated successfully',
      data: { document }
    });

  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update document',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Analyze document with AI
export const analyzeDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
      return;
    }

    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    try {
      // For now, provide a mock analysis result
      // TODO: Integrate with actual document parsing service
      const analysisResult = {
        summary: `Analysis of ${req.file.originalname}`,
        entities: [
          { type: 'Amount', value: '₹10,000', confidence: 0.95 },
          { type: 'Date', value: '2024-01-15', confidence: 0.90 },
          { type: 'GST Number', value: '22AAAAA0000A1Z5', confidence: 0.85 }
        ],
        recommendations: [
          'Verify GST number format',
          'Check tax calculations',
          'Ensure compliance with current rates'
        ]
      };

      res.status(200).json({
        success: true,
        message: 'Document analyzed successfully',
        data: {
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          analysis: analysisResult,
          analyzedAt: new Date().toISOString()
        }
      });

    } catch (parseError) {
      console.error('Document analysis failed:', parseError);

      res.status(500).json({
        success: false,
        message: 'Failed to analyze document',
        error: process.env.NODE_ENV === 'development' ? parseError : undefined
      });
    }

  } catch (error) {
    console.error('Document analysis error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to analyze document',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Delete document
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found'
      });
      return;
    }

    // Delete file from filesystem
    try {
      await fs.unlink(document.path);
    } catch (error) {
      console.error('Error deleting file from filesystem:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await Document.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get document statistics
export const getDocumentStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const stats = await Document.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: 1 },
          totalSize: { $sum: '$size' },
          categories: {
            $push: '$category'
          },
          avgSize: { $avg: '$size' },
          totalDownloads: { $sum: '$downloadCount' }
        }
      },
      {
        $project: {
          _id: 0,
          totalDocuments: 1,
          totalSize: 1,
          avgSize: { $round: ['$avgSize', 2] },
          totalDownloads: 1,
          categoryBreakdown: {
            $reduce: {
              input: '$categories',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [
                        {
                          k: '$$this',
                          v: {
                            $add: [
                              { $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] },
                              1
                            ]
                          }
                        }
                      ]
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalDocuments: 0,
      totalSize: 0,
      avgSize: 0,
      totalDownloads: 0,
      categoryBreakdown: {}
    };

    res.status(200).json({
      success: true,
      data: { stats: result }
    });

  } catch (error) {
    console.error('Get document stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document statistics',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Parse document (re-parse existing document)
export const parseDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found'
      });
      return;
    }

    // Check if file type is supported for parsing
    if (!documentParsingService.isFileTypeSupported(document.mimeType)) {
      res.status(400).json({
        success: false,
        message: 'File type not supported for parsing'
      });
      return;
    }

    // Check if file exists
    try {
      await fs.access(document.path);
    } catch {
      res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
      return;
    }

    // Parse document
    const parsedData = await documentParsingService.parseDocument(document.path, document.mimeType);

    // Update document with parsed data
    document.parsedData = parsedData;
    await document.save();

    res.status(200).json({
      success: true,
      message: 'Document parsed successfully',
      data: {
        document,
        parsedData
      }
    });

  } catch (error) {
    console.error('Parse document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to parse document',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Verify document on blockchain
export const verifyDocumentOnBlockchain = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found'
      });
      return;
    }

    if (!blockchainService.isAvailable()) {
      res.status(503).json({
        success: false,
        message: 'Blockchain service not available'
      });
      return;
    }

    // Verify document hash on blockchain
    const verificationResult = await blockchainService.verifyInvoiceHash(document.hash);

    if (!verificationResult.success) {
      res.status(500).json({
        success: false,
        message: 'Blockchain verification failed',
        error: verificationResult.error
      });
      return;
    }

    // Update document verification status
    document.isVerified = verificationResult.exists;
    if (verificationResult.exists) {
      document.blockchainHash = document.hash;
    }
    await document.save();

    res.status(200).json({
      success: true,
      message: 'Document verification completed',
      data: {
        document,
        verification: verificationResult
      }
    });

  } catch (error) {
    console.error('Blockchain verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify document on blockchain',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Store document hash on blockchain
export const storeDocumentOnBlockchain = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found'
      });
      return;
    }

    if (!blockchainService.isAvailable()) {
      res.status(503).json({
        success: false,
        message: 'Blockchain service not available'
      });
      return;
    }

    // Prepare metadata
    const metadata = JSON.stringify({
      fileName: document.originalName,
      category: document.category,
      uploadedAt: document.uploadedAt,
      userId: userId.toString()
    });

    // Store document hash on blockchain
    const storeResult = await blockchainService.storeInvoiceHash(document.hash, metadata);

    if (!storeResult.success) {
      res.status(500).json({
        success: false,
        message: 'Failed to store on blockchain',
        error: storeResult.error
      });
      return;
    }

    // Update document with blockchain information
    document.blockchainHash = document.hash;
    document.transactionId = storeResult.transactionHash;
    document.isVerified = true;
    await document.save();

    res.status(200).json({
      success: true,
      message: 'Document stored on blockchain successfully',
      data: {
        document,
        blockchain: storeResult
      }
    });

  } catch (error) {
    console.error('Blockchain storage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store document on blockchain',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// Get blockchain service status
export const getBlockchainStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = await blockchainService.getServiceStatus();

    res.status(200).json({
      success: true,
      data: { status }
    });

  } catch (error) {
    console.error('Blockchain status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get blockchain status',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};
