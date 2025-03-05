// src/services/ai/categorization.service.ts

import { OpenAI } from 'openai';
import { Email, EmailCategory } from '../../models/email.model';
import config from '../../config/config';

export class EmailCategorizationService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }
  
  // Categorize an email using AI
  public async categorizeEmail(email: Email): Promise<EmailCategory> {
    try {
      // Extract the relevant parts of the email for categorization
      const subject = email.headers.subject || '';
      const body = email.body.text || email.body.html || '';
      
      // Create prompt for the AI
      const prompt = `
        You are an AI assistant that categorizes emails. 
        Based on the following email, categorize it into one of these categories:
        - Interested: The sender is showing interest in a product or service
        - Meeting Booked: The sender is confirming or scheduling a meeting
        - Not Interested: The sender is explicitly not interested
        - Spam: The email is unsolicited or spam
        - Out of Office: The sender is out of office or unavailable
        
        Email Subject: ${subject}
        
        Email Body:
        ${body.substring(0, 1000)}
        
        Category:
      `;
      
      // Get AI to categorize the email
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0.3
      });
      
      // Extract the category from the response
      const categoryText = response.choices[0].message.content?.trim();
      
      // Map the response to our EmailCategory type
      let category: EmailCategory = 'Uncategorized';
      
      if (categoryText?.includes('Interested')) {
        category = 'Interested';
      } else if (categoryText?.includes('Meeting Booked')) {
        category = 'Meeting Booked';
      } else if (categoryText?.includes('Not Interested')) {
        category = 'Not Interested';
      } else if (categoryText?.includes('Spam')) {
        category = 'Spam';
      } else if (categoryText?.includes('Out of Office')) {
        category = 'Out of Office';
      }
      
      console.log(`Categorized email ${email.id} as: ${category}`);
      return category;
    } catch (error) {
      console.error('Error categorizing email:', error);
      return 'Uncategorized';
    }
  }
  
  // Generate a suggested reply using RAG
  public async generateReply(email: Email, productInfo: string): Promise<string> {
    try {
      // Extract the relevant parts of the email
      const fromAddress = email.headers.from || '';
      const subject = email.headers.subject || '';
      const body = email.body.text || email.body.html || '';
      
      // Create prompt for the AI with RAG context
      const prompt = `
        You are an AI assistant helping to draft email replies.
        
        PRODUCT INFORMATION:
        ${productInfo}
        
        EMAIL FROM: ${fromAddress}
        SUBJECT: ${subject}
        
        EMAIL CONTENT:
        ${body.substring(0, 1000)}
        
        Based on the email content and product information, write a concise and professional reply.
        The reply should be personalized, address the specific questions or concerns in the email,
        and include relevant information from the product details.
      `;
      
      // Get AI to generate a reply
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7
      });
      
      return response.choices[0].message.content?.trim() || '';
    } catch (error) {
      console.error('Error generating email reply:', error);
      return 'Sorry, I was unable to generate a reply at this time.';
    }
  }
}

export default new EmailCategorizationService();