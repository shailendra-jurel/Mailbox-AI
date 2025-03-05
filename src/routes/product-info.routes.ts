// src/routes/product-info.routes.ts

import { Router } from 'express';
import productInfoController from '../controllers/product-info.controller';

const router = Router();

// Product info routes
router.get('/', productInfoController.getAllProductInfo);
router.post('/', productInfoController.addProductInfo);

export default router;

