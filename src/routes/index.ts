// src/routes/index.ts

import { Router } from 'express';
import emailRoutes from './email.routes';
import productInfoRoutes from './product-info.routes';

const router = Router();

// API routes
router.use('/api/emails', emailRoutes);
router.use('/api/product-info', productInfoRoutes);

export default router;