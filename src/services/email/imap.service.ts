// src/services/email/imap.service.ts

import * as IMAP from 'imap';
import { simpleParser } from 'mailparser';
import { EventEmitter } from 'events';
import { Email, EmailCategory } from '../../models/email.model';
import config from '../../config/config';
import { v4 as uuidv4 } from 'uuid';

// Add the missing dependency
// npm install mailparser uuid
// npm install @types/mailparser @types/uuid --save-dev

interface EmailAccount {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

export class ImapService extends EventEmitter {
  private connections: Map<string, IMAP> = new Map();
  private readonly startDate: Date;
  private readonly emailAccounts: EmailAccount[];

  constructor() {
    super();
    // Calculate the date 30 days ago for initial sync
    this.startDate = new Date();
    this.startDate.setDate(this.startDate.getDate() - 30);
    this.emailAccounts = config.emailAccounts;
  }

  // Start syncing all configured email accounts
  public async startSync(): Promise<void> {
    for (let i = 0; i < this.emailAccounts.length; i++) {
      const account = this.emailAccounts[i];
      const accountId = `account-${i + 1}`;
      
      try {
        await this.connectAndSync(account, accountId);
        console.log(`Connected to account: ${accountId} (${account.user})`);
      } catch (error) {
        console.error(`Failed to connect to account: ${accountId}`, error);
      }
    }
  }

  // Connect to an email account and start syncing
  private async connectAndSync(account: EmailAccount, accountId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new IMAP({
        user: account.user,
        password: account.password,
        host: account.host,
        port: account.port,
        tls: account.tls,
        tlsOptions: { rejectUnauthorized: false }
      });

      // Store the connection for later use
      this.connections.set(accountId, imap);

      // Setup event handlers
      imap.once('ready', () => {
        console.log(`IMAP connection ready for ${accountId}`);
        this.syncMailboxes(imap, accountId)
          .then(() => resolve())
          .catch(reject);
      });

      imap.once('error', (err: Error) => {
        console.error(`IMAP connection error for ${accountId}:`, err);
        reject(err);
      });

      imap.once('end', () => {
        console.log(`IMAP connection ended for ${accountId}`);
        // Reconnect after a delay if disconnected unexpectedly
        setTimeout(() => {
          this.connectAndSync(account, accountId).catch(console.error);
        }, 10000);
      });

      // Connect to the server
      imap.connect();
    });
  }

  // Sync all mailboxes for an account
  private async syncMailboxes(imap: IMAP, accountId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      imap.getBoxes((err, boxes) => {
        if (err) return reject(err);
        
        // Get all mailbox paths
        const mailboxes = this.flattenMailboxes(boxes);
        
        // Sync each mailbox
        Promise.all(mailboxes.map(mailbox => 
          this.syncMailbox(imap, accountId, mailbox)
        ))
        .then(() => resolve())
        .catch(reject);
      });
    });
  }

  // Flatten the nested mailbox structure into a flat array of paths
  private flattenMailboxes(boxes: IMAP.MailBoxes, prefix = ''): string[] {
    let mailboxes: string[] = [];
    
    for (const key in boxes) {
      const path = prefix ? `${prefix}${key}` : key;
      mailboxes.push(path);
      
      if (boxes[key].children) {
        mailboxes = mailboxes.concat(
          this.flattenMailboxes(boxes[key].children!, `${path}${boxes[key].delimiter}`)
        );
      }
    }
    
    return mailboxes;
  }

  // Sync a specific mailbox
  private async syncMailbox(imap: IMAP, accountId: string, mailbox: string): Promise<void> {
    return new Promise((resolve, reject) => {
      imap.openBox(mailbox, true, (err, box) => {
        if (err) {
          console.error(`Error opening mailbox ${mailbox}:`, err);
          return resolve(); // Skip this mailbox but continue with others
        }
        
        // Create search criteria for emails since startDate
        const since = this.startDate.toISOString().substring(0, 10);
        
        // Search for messages
        imap.search(['SINCE', since], (err, results) => {
          if (err) {
            console.error(`Error searching in mailbox ${mailbox}:`, err);
            return resolve(); // Skip but continue
          }
          
          if (!results || results.length === 0) {
            console.log(`No messages found in ${mailbox} since ${since}`);
            
            // Setup IDLE mode for real-time updates
            this.setupIdleMode(imap, accountId, mailbox);
            
            return resolve();
          }
          
          // Fetch messages
          const fetch = imap.fetch(results, {
            bodies: '',
            struct: true
          });
          
          fetch.on('message', (msg, seqno) => {
            const emailData: any = {};
            
            msg.on('body', (stream, info) => {
              let buffer = '';
              
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              
              stream.once('end', () => {
                emailData.raw = buffer;
              });
            });
            
            msg.once('attributes', (attrs) => {
              emailData.attrs = attrs;
            });
            
            msg.once('end', () => {
              // Parse the raw email
              simpleParser(emailData.raw)
                .then(parsed => {
                  const email: Email = {
                    id: uuidv4(),
                    accountId,
                    folder: mailbox,
                    headers: {
                      from: parsed.from?.text,
                      to: parsed.to?.text,
                      cc: parsed.cc?.text,
                      bcc: parsed.bcc?.text,
                      subject: parsed.subject,
                      date: parsed.date,
                      messageId: parsed.messageId
                    },
                    body: {
                      html: parsed.html || undefined,
                      text: parsed.text || undefined
                    },
                    isRead: !!(emailData.attrs.flags && emailData.attrs.flags.includes('\\Seen')),
                    isFlagged: !!(emailData.attrs.flags && emailData.attrs.flags.includes('\\Flagged')),
                    receivedDate: parsed.date || new Date(),
                    syncedAt: new Date(),
                    category: 'Uncategorized' as EmailCategory
                  };
                  
                  // Emit the email for processing and storage
                  this.emit('email', email);
                })
                .catch(err => {
                  console.error('Error parsing email:', err);
                });
            });
          });
          
          fetch.once('error', (err) => {
            console.error(`Fetch error in ${mailbox}:`, err);
          });
          
          fetch.once('end', () => {
            console.log(`Fetched ${results.length} messages from ${mailbox}`);
            
            // Setup IDLE mode for real-time updates after initial sync
            this.setupIdleMode(imap, accountId, mailbox);
            
            resolve();
          });
        });
      });
    });
  }

  // Setup IDLE mode for real-time updates
  private setupIdleMode(imap: IMAP, accountId: string, mailbox: string): void {
    if (!imap.serverSupports('IDLE')) {
      console.warn(`IMAP server for ${accountId} does not support IDLE mode`);
      return;
    }
    
    let idleTimer: NodeJS.Timeout;
    
    const startIdle = () => {
      console.log(`Starting IDLE mode for ${accountId} - ${mailbox}`);
      
      // Some servers timeout IDLE after 30 minutes, so we'll refresh every 29 minutes
      idleTimer = setTimeout(() => {
        imap.idle();
        console.log(`Refreshing IDLE connection for ${accountId} - ${mailbox}`);
        startIdle();
      }, 29 * 60 * 1000);
      
      // Start IDLE mode
      imap.idle();
    };
    
    // Handle new messages during IDLE
    imap.on('mail', (numNewMsgs) => {
      console.log(`Received ${numNewMsgs} new messages in ${mailbox}`);
      
      // Stop IDLE and restart it after syncing
      clearTimeout(idleTimer);
      imap.idle();
      
      // Get the most recent messages
      this.syncMailbox(imap, accountId, mailbox)
        .catch(err => {
          console.error(`Error resyncing ${mailbox} after new mail:`, err);
          startIdle();
        });
    });
    
    // Start IDLE mode
    startIdle();
  }

  // Close all connections
  public closeAllConnections(): void {
    for (const [accountId, connection] of this.connections.entries()) {
      console.log(`Closing connection to ${accountId}`);
      connection.end();
    }
  }
}

export default new ImapService();