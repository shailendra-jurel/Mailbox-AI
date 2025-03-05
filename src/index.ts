// src/index.ts

import express from 'express';
import cors from 'cors';
import path from 'path';
import config from './config/config';
import routes from './routes';
import emailProcessingService from './services/email/processing.service';

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use(routes);

// Serve the frontend for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start the server
const PORT = config.app.port;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  try {
    // Start the email processing service
    await emailProcessingService.start();
    console.log('Email processing service started successfully');
  } catch (error) {
    console.error('Failed to start email processing service:', error);
  }
});

// Handle application shutdown
process.on('SIGINT', () => {
  console.log('Application shutting down...');
  
  // Stop the email processing service
  emailProcessingService.stop();
  
  process.exit(0);
});