// src/models/email.model.ts

export interface EmailHeader {
    from?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    date?: Date;
    messageId?: string;
  }
  
  export interface EmailBody {
    html?: string;
    text?: string;
  }
  
  export interface EmailAttachment {
    filename: string;
    contentType: string;
    size: number;
    content?: Buffer;
  }
  
  export type EmailCategory = 
    | 'Interested' 
    | 'Meeting Booked' 
    | 'Not Interested' 
    | 'Spam' 
    | 'Out of Office' 
    | 'Uncategorized';
  
  export interface Email {
    id: string;
    accountId: string;
    folder: string;
    headers: EmailHeader;
    body: EmailBody;
    attachments?: EmailAttachment[];
    category?: EmailCategory;
    isRead: boolean;
    isFlagged: boolean;
    receivedDate: Date;
    syncedAt: Date;
  }