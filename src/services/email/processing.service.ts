// src/services/email/processing.service.ts

import { Email, EmailCategory } from '../../models/email.model';
import imapService from './imap.service';
import elasticsearchService from '../search/elasticsearch.service';
import categorizationService from '../ai/categorization.service';
import notificationService from '../integration/notification.service';

export class EmailProcessingService {
  constructor() {
    // Set up event listeners for incoming emails
    this.setupEventListeners();
  }

  // Set up event listeners
  private setupEventListeners(): void {
    // Listen for new emails from IMAP service
    imapService.on('email', async (email: Email) => {
      try {
        // Process the email
        await this.processEmail(email);
      } catch (error) {
        console.error('Error processing email:', error);
      }
    });
  }

  // Process a new email
  private async processEmail(email: Email): Promise<void> {
    try {
      console.log(`Processing email: ${email.id} - ${email.headers.subject}`);
      
      // Step 1: Store the email in Elasticsearch
      await elasticsearchService.indexEmail(email);
      
      // Step 2: Categorize the email using AI
      const category = await categorizationService.categorizeEmail(email);
      
      // Step 3: Update the email with its category
      email.category = category;
      await elasticsearchService.updateEmailCategory(email.id, category);
      
      // Step 4: If the email is categorized as 'Interested', send notifications
      if (category === 'Interested') {
        await this.handleInterestedEmail(email);
      }
    } catch (error) {
      console.error(`Error processing email ${email.id}:`, error);
    }
  }

  // Handle emails categorized as 'Interested'
  private async handleInterestedEmail(email: Email): Promise<void> {
    try {
      console.log(`Handling interested email: ${email.id}`);
      
      // Send Slack notification
      await notificationService.sendSlackNotification(email);
      
      // Send webhook notification
      await notificationService.sendWebhookNotification(email);
    } catch (error) {
      console.error(`Error handling interested email ${email.id}:`, error);
    }
  }

  // Start the email processing pipeline
  public async start(): Promise<void> {
    try {
      console.log('Starting email processing service...');
      
      // Start the IMAP service to begin syncing emails
      await imapService.startSync();
      
      console.log('Email processing service started successfully');
    } catch (error) {
      console.error('Error starting email processing service:', error);
      throw error;
    }
  }

  // Stop the email processing pipeline
  public stop(): void {
    console.log('Stopping email processing service...');
    
    // Close all IMAP connections
    imapService.closeAllConnections();
    
    console.log('Email processing service stopped');
  }
}

export default new EmailProcessingService();