// src/controllers/product-info.controller.ts

import { Request, Response } from 'express';
import vectorDatabaseService from '../services/ai/vector-database.service';

export class ProductInfoController {
  // Add product information
  public async addProductInfo(req: Request, res: Response): Promise<void> {
    try {
      const { id, content } = req.body;
      
      // Validate request
      if (!id || !content) {
        res.status(400).json({ error: 'ID and content are required' });
        return;
      }
      
      // Add to vector database
      const success = await vectorDatabaseService.addProductInfo(id, content);
      
      if (success) {
        res.json({ success: true, message: 'Product information added successfully' });
      } else {
        res.status(500).json({ error: 'Failed to add product information' });
      }
    } catch (error) {
      console.error('Error adding product information:', error);
      res.status(500).json({ error: 'Failed to add product information' });
    }
  }

  // Get all product information
  public async getAllProductInfo(req: Request, res: Response): Promise<void> {
    try {
      const productInfo = vectorDatabaseService.getAllProductInfo();
      
      res.json(productInfo);
    } catch (error) {
      console.error('Error getting product information:', error);
      res.status(500).json({ error: 'Failed to retrieve product information' });
    }
  }
}

export default new ProductInfoController();