// src/services/integration/notification.service.ts

import axios from 'axios';
import { Email } from '../../models/email.model';
import config from '../../config/config';

export class NotificationService {
  // Send a notification to Slack
  public async sendSlackNotification(email: Email): Promise<boolean> {
    try {
      if (!config.slack.webhookUrl) {
        console.warn('Slack webhook URL not configured, skipping notification');
        return false;
      }
      
      // Format the message for Slack
      const message = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🎯 Interested Lead Detected!',
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*From:* ${email.headers.from || 'Unknown'}`
              },
              {
                type: 'mrkdwn',
                text: `*Category:* ${email.category}`
              },
              {
                type: 'mrkdwn',
                text: `*Subject:* ${email.headers.subject || 'No subject'}`
              },
              {
                type: 'mrkdwn',
                text: `*Received:* ${email.receivedDate.toLocaleString()}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Email Preview:*\n${(email.body.text || '').substring(0, 200)}...`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View Details',
                  emoji: true
                },
                value: email.id,
                url: `http://localhost:3000/emails/${email.id}`
              }
            ]
          }
        ]
      };
      
      // Send to Slack
      const response = await axios.post(config.slack.webhookUrl, message);
      console.log(`Slack notification sent for email ${email.id}, status: ${response.status}`);
      
      return response.status === 200;
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      return false;
    }
  }

  // Send a webhook notification to external system
  public async sendWebhookNotification(email: Email): Promise<boolean> {
    try {
      if (!config.webhook.externalUrl) {
        console.warn('External webhook URL not configured, skipping notification');
        return false;
      }
      
      // Prepare webhook payload
      const payload = {
        id: email.id,
        from: email.headers.from,
        subject: email.headers.subject,
        category: email.category,
        receivedDate: email.receivedDate,
        messagePreview: (email.body.text || '').substring(0, 200),
        accountInfo: {
          accountId: email.accountId,
          folder: email.folder
        }
      };
      
      // Send to external webhook
      const response = await axios.post(config.webhook.externalUrl, payload);
      console.log(`Webhook notification sent for email ${email.id}, status: ${response.status}`);
      
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('Error sending webhook notification:', error);
      return false;
    }
  }
}

export default new NotificationService();