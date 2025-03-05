// src/controllers/email.controller.ts

import { Request, Response } from 'express';
import elasticsearchService from '../services/search/elasticsearch.service';
import categorizationService from '../services/ai/categorization.service';
import vectorDatabaseService from '../services/ai/vector-database.service';
import { EmailCategory } from '../models/email.model';

export class EmailController {
  // Get emails with search and filters
  public async getEmails(req: Request, res: Response): Promise<void> {
    try {
      const {
        query,
        accountId,
        folder,
        category,
        from,
        to,
        startDate,
        endDate,
        page = '1',
        size = '20'
      } = req.query;
      
      // Parse dates if provided
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;
      
      if (typeof startDate === 'string' && startDate) {
        parsedStartDate = new Date(startDate);
      }
      
      if (typeof endDate === 'string' && endDate) {
        parsedEndDate = new Date(endDate);
      }
      
      // Search for emails
      const result = await elasticsearchService.searchEmails({
        query: typeof query === 'string' ? query : undefined,
        accountId: typeof accountId === 'string' ? accountId : undefined,
        folder: typeof folder === 'string' ? folder : undefined,
        category: typeof category === 'string' ? category as EmailCategory : undefined,
        from: typeof from === 'string' ? from : undefined,
        to: typeof to === 'string' ? to : undefined,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        page: parseInt(page as string, 10),
        size: parseInt(size as string, 10)
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error getting emails:', error);
      res.status(500).json({ error: 'Failed to retrieve emails' });
    }
  }

  // Get email by ID
  public async getEmailById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const email = await elasticsearchService.getEmailById(id);
      
      if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }
      
      res.json(email);
    } catch (error) {
      console.error(`Error getting email ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to retrieve email' });
    }
  }

  // Update email category
  public async updateEmailCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { category } = req.body;
      
      // Validate category
      if (!category || !['Interested', 'Meeting Booked', 'Not Interested', 'Spam', 'Out of Office', 'Uncategorized'].includes(category)) {
        res.status(400).json({ error: 'Invalid category' });
        return;
      }
      
      // Get the email first to make sure it exists
      const email = await elasticsearchService.getEmailById(id);
      
      if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }
      
      // Update the category
      await elasticsearchService.updateEmailCategory(id, category as EmailCategory);
      
      res.json({ success: true, message: 'Email category updated successfully' });
    } catch (error) {
      console.error(`Error updating email category for ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to update email category' });
    }
  }

  // Get email counts by category
  public async getEmailCountsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const counts = await elasticsearchService.getEmailCountsByCategory();
      
      res.json(counts);
    } catch (error) {
      console.error('Error getting email counts by category:', error);
      res.status(500).json({ error: 'Failed to retrieve email counts' });
    }
  }

  // Generate suggested reply
  public async generateSuggestedReply(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Get the email
      const email = await elasticsearchService.getEmailById(id);
      
      if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }
      
      // Retrieve relevant product information using RAG
      const query = `${email.headers.subject || ''} ${email.body.text || ''}`.substring(0, 500);
      const productInfo = await vectorDatabaseService.retrieveRelevantInfo(query);
      
      // Generate suggested reply
      const suggestedReply = await categorizationService.generateReply(email, productInfo);
      
      res.json({ suggestedReply });
    } catch (error) {
      console.error(`Error generating suggested reply for email ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to generate suggested reply' });
    }
  }
}

export default new EmailController();