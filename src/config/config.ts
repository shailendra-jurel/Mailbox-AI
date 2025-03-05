import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Define email account interface
interface EmailAccount {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

// Create email accounts array from environment variables
const createEmailAccounts = (): EmailAccount[] => {
  const accounts: EmailAccount[] = [];
  let accountIndex = 1;
  
  while (process.env[`EMAIL_HOST_${accountIndex}`]) {
    accounts.push({
      host: process.env[`EMAIL_HOST_${accountIndex}`] || '',
      port: parseInt(process.env[`EMAIL_PORT_${accountIndex}`] || '993'),
      user: process.env[`EMAIL_USER_${accountIndex}`] || '',
      password: process.env[`EMAIL_PASS_${accountIndex}`] || '',
      tls: process.env[`EMAIL_TLS_${accountIndex}`] === 'true',
    });
    
    accountIndex++;
  }
  
  return accounts;
};

export default {
  app: {
    port: parseInt(process.env.PORT || '3000'),
    env: process.env.NODE_ENV || 'development',
  },
  elasticsearch: {
    host: process.env.ELASTICSEARCH_HOST || 'http://localhost:9200',
  },
  emailAccounts: createEmailAccounts(),
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  },
  webhook: {
    externalUrl: process.env.EXTERNAL_WEBHOOK_URL || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
};