// src/services/ai/vector-database.service.ts

import { OpenAI } from 'openai';
import config from '../../config/config';

// Define the data structure for product information
interface ProductInfo {
  id: string;
  content: string;
  embedding: number[];
}

export class VectorDatabaseService {
  private openai: OpenAI;
  private productDatabase: ProductInfo[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    
    // Initialize with some default product information
    this.initializeDatabase();
  }

  // Initialize the vector database with default product information
  private async initializeDatabase(): Promise<void> {
    try {
      const productInfoContent = `
        ReachInbox is transforming cold outreach with our revolutionary AI-driven platform.
        Our all-in-one solution empowers businesses to effortlessly find, enrich, and engage high-intent leads through multi-channel outreach on Twitter, LinkedIn, email, and phone.
        With just a single prompt, ReachInbox springs into action, prospecting and verifying leads, crafting personalized sequences, and notifying businesses of responsive prospects.
        
        Key features:
        - Multi-channel outreach (Twitter, LinkedIn, email, phone)
        - AI-powered lead prospecting and verification
        - Automated personalized sequences
        - Real-time notifications for responsive leads
        
        Meeting booking information:
        If a lead is interested in learning more about ReachInbox, please share our meeting booking link: https://calendly.com/reachinbox/demo
        
        Pricing information:
        - Starter Plan: $49/month - Up to 100 leads
        - Professional Plan: $99/month - Up to 500 leads
        - Enterprise Plan: $199/month - Unlimited leads
        
        Response guidelines:
        - Always respond within 24 hours
        - Be professional and courteous
        - Address all questions directly
        - Provide clear next steps
      `;
      
      // Create embedding for the product information
      const embedding = await this.createEmbedding(productInfoContent);
      
      // Add to database
      this.productDatabase.push({
        id: 'default-product-info',
        content: productInfoContent,
        embedding
      });
      
      console.log('Vector database initialized with default product information');
    } catch (error) {
      console.error('Error initializing vector database:', error);
    }
  }

  // Create embedding for a text
  private async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error creating embedding:', error);
      return [];
    }
  }

  // Add product information to the database
  public async addProductInfo(id: string, content: string): Promise<boolean> {
    try {
      // Create embedding for the content
      const embedding = await this.createEmbedding(content);
      
      // Check if product info with this ID already exists
      const existingIndex = this.productDatabase.findIndex(item => item.id === id);
      
      if (existingIndex >= 0) {
        // Update existing product info
        this.productDatabase[existingIndex] = {
          id,
          content,
          embedding
        };
      } else {
        // Add new product info
        this.productDatabase.push({
          id,
          content,
          embedding
        });
      }
      
      console.log(`Product information "${id}" added to vector database`);
      return true;
    } catch (error) {
      console.error(`Error adding product information ${id}:`, error);
      return false;
    }
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimensions');
    }
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }
    
    return dotProduct / (mag1 * mag2);
  }

  // Retrieve the most relevant product information for a query
  public async retrieveRelevantInfo(query: string): Promise<string> {
    try {
      // If database is empty, return empty string
      if (this.productDatabase.length === 0) {
        return '';
      }
      
      // Create embedding for the query
      const queryEmbedding = await this.createEmbedding(query);
      
      // Find the most similar product information
      let highestSimilarity = -1;
      let mostRelevantInfo = '';
      
      for (const product of this.productDatabase) {
        const similarity = this.cosineSimilarity(queryEmbedding, product.embedding);
        
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          mostRelevantInfo = product.content;
        }
      }
      
      return mostRelevantInfo;
    } catch (error) {
      console.error('Error retrieving relevant product information:', error);
      
      // Return the first product info as fallback
      return this.productDatabase.length > 0 ? this.productDatabase[0].content : '';
    }
  }

  // Get all product information content
  public getAllProductInfo(): string[] {
    return this.productDatabase.map(product => product.content);
  }
}

export default new VectorDatabaseService();