// src/services/search/elasticsearch.service.ts

import { Client } from '@elastic/elasticsearch';
import config from '../../config/config';
import { Email, EmailCategory } from '../../models/email.model';

export class ElasticsearchService {
  private readonly client: Client;
  private readonly indexName = 'emails';

  constructor() {
    this.client = new Client({
      node: config.elasticsearch.host
    });
    this.initializeIndex();
  }

  // Initialize the Elasticsearch index with proper mappings
  private async initializeIndex(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.indexName
      });

      if (!indexExists.body) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                accountId: { type: 'keyword' },
                folder: { type: 'keyword' },
                'headers.from': { type: 'text', analyzer: 'standard' },
                'headers.to': { type: 'text', analyzer: 'standard' },
                'headers.cc': { type: 'text', analyzer: 'standard' },
                'headers.bcc': { type: 'text', analyzer: 'standard' },
                'headers.subject': { type: 'text', analyzer: 'standard' },
                'headers.date': { type: 'date' },
                'headers.messageId': { type: 'keyword' },
                'body.text': { type: 'text', analyzer: 'standard' },
                'body.html': { type: 'text', analyzer: 'standard' },
                category: { type: 'keyword' },
                isRead: { type: 'boolean' },
                isFlagged: { type: 'boolean' },
                receivedDate: { type: 'date' },
                syncedAt: { type: 'date' }
              }
            }
          }
        });
        console.log('Elasticsearch index created successfully');
      } else {
        console.log('Elasticsearch index already exists');
      }
    } catch (error) {
      console.error('Error initializing Elasticsearch index:', error);
    }
  }

  // Index an email in Elasticsearch
  public async indexEmail(email: Email): Promise<void> {
    try {
      await this.client.index({
        index: this.indexName,
        id: email.id,
        body: email,
        refresh: true // Immediate refresh for testing
      });
      console.log(`Indexed email: ${email.id}`);
    } catch (error) {
      console.error('Error indexing email:', error);
    }
  }

  // Update email category in Elasticsearch
  public async updateEmailCategory(emailId: string, category: EmailCategory): Promise<void> {
    try {
      await this.client.update({
        index: this.indexName,
        id: emailId,
        body: {
          doc: {
            category
          }
        },
        refresh: true
      });
      console.log(`Updated email ${emailId} with category: ${category}`);
    } catch (error) {
      console.error(`Error updating email category for ${emailId}:`, error);
    }
  }

  // Search emails with various filters
  public async searchEmails({
    query,
    accountId,
    folder,
    category,
    from,
    to,
    startDate,
    endDate,
    page = 1,
    size = 20
  }: {
    query?: string;
    accountId?: string;
    folder?: string;
    category?: EmailCategory;
    from?: string;
    to?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    size?: number;
  }): Promise<{ total: number; emails: Email[] }> {
    try {
      const must: any[] = [];
      
      // Full-text search query across multiple fields
      if (query) {
        must.push({
          multi_match: {
            query,
            fields: [
              'headers.subject^2', // Boost subject matches
              'headers.from',
              'headers.to',
              'body.text'
            ]
          }
        });
      }
      
      // Filter by account
      if (accountId) {
        must.push({
          term: { accountId }
        });
      }
      
      // Filter by folder
      if (folder) {
        must.push({
          term: { folder }
        });
      }
      
      // Filter by category
      if (category) {
        must.push({
          term: { category }
        });
      }
      
      // Filter by sender
      if (from) {
        must.push({
          match: { 'headers.from': from }
        });
      }
      
      // Filter by recipient
      if (to) {
        must.push({
          match: { 'headers.to': to }
        });
      }
      
      // Filter by date range
      if (startDate || endDate) {
        const range: any = {};
        if (startDate) range.gte = startDate.toISOString();
        if (endDate) range.lte = endDate.toISOString();
        
        must.push({
          range: { receivedDate: range }
        });
      }
      
      // Pagination
      const from = (page - 1) * size;
      
      // Perform the search
      const result = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              must
            }
          },
          sort: [
            { receivedDate: { order: 'desc' } }
          ],
          from,
          size
        }
      });
      
      // Extract results
      const total = result.body.hits.total.value;
      const emails = result.body.hits.hits.map((hit: any) => hit._source as Email);
      
      return { total, emails };
    } catch (error) {
      console.error('Error searching emails:', error);
      return { total: 0, emails: [] };
    }
  }

  // Get email by ID
  public async getEmailById(id: string): Promise<Email | null> {
    try {
      const result = await this.client.get({
        index: this.indexName,
        id
      });
      
      return result.body._source as Email;
    } catch (error) {
      console.error(`Error getting email by ID ${id}:`, error);
      return null;
    }
  }

  // Delete email from index
  public async deleteEmail(id: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id,
        refresh: true
      });
      console.log(`Deleted email: ${id}`);
    } catch (error) {
      console.error(`Error deleting email ${id}:`, error);
    }
  }

  // Get email counts by category
  public async getEmailCountsByCategory(): Promise<Record<EmailCategory, number>> {
    try {
      const result = await this.client.search({
        index: this.indexName,
        body: {
          size: 0,
          aggs: {
            categories: {
              terms: {
                field: 'category',
                size: 10
              }
            }
          }
        }
      });
      
      const categories = result.body.aggregations.categories.buckets;
      const counts: Partial<Record<EmailCategory, number>> = {};
      
      categories.forEach((bucket: any) => {
        counts[bucket.key as EmailCategory] = bucket.doc_count;
      });
      
      return {
        'Interested': counts['Interested'] || 0,
        'Meeting Booked': counts['Meeting Booked'] || 0,
        'Not Interested': counts['Not Interested'] || 0,
        'Spam': counts['Spam'] || 0,
        'Out of Office': counts['Out of Office'] || 0,
        'Uncategorized': counts['Uncategorized'] || 0
      };
    } catch (error) {
      console.error('Error getting email counts by category:', error);
      return {
        'Interested': 0,
        'Meeting Booked': 0,
        'Not Interested': 0,
        'Spam': 0,
        'Out of Office': 0,
        'Uncategorized': 0
      };
    }
  }
}

export default new ElasticsearchService();