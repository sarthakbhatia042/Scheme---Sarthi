import { Router } from 'express';
import multer from 'multer';
import {
  listSchemes,
  getScheme,
  createScheme,
  updateScheme,
  deleteScheme,
  bulkUploadSchemes,
  getCsvTemplateDownload,
  extractPdfScheme
} from '../controllers/schemeController.js';
import { protect, adminOnly } from '../middleware/auth.js';

// Configure multer memory storage (limit 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

const router = Router();

// Public Routes
router.get('/csv-template', getCsvTemplateDownload);
router.get('/', listSchemes);
router.get('/:id', getScheme);

// Admin-only Routes
router.post('/bulk-upload', protect, adminOnly, upload.single('file'), bulkUploadSchemes);
router.post('/extract-pdf', protect, adminOnly, upload.single('file'), extractPdfScheme);
router.post('/', protect, adminOnly, createScheme);
router.put('/:id', protect, adminOnly, updateScheme);
router.delete('/:id', protect, adminOnly, deleteScheme);

export default router;
