import { getEmailService } from './emailService';

interface EmailJob {
  id: string;
  type: 'invoice' | 'receipt' | 'reminder' | 'welcome' | 'verification';
  to: string;
  data: any;
  pdfBuffer?: Buffer;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  scheduledAt?: Date;
}

class EmailQueueService {
  private static instance: EmailQueueService;
  private queue: EmailJob[] = [];
  private processing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  static getInstance(): EmailQueueService {
    if (!EmailQueueService.instance) {
      EmailQueueService.instance = new EmailQueueService();
    }
    return EmailQueueService.instance;
  }

  constructor() {
    this.startProcessing();
  }

  /**
   * Add email job to queue for background processing
   */
  async queueInvoiceEmail(
    to: string,
    invoiceData: any,
    pdfBuffer: Buffer,
    priority: boolean = false
  ): Promise<string> {
    const job: EmailJob = {
      id: this.generateJobId(),
      type: 'invoice',
      to,
      data: invoiceData,
      pdfBuffer,
      retries: 0,
      maxRetries: 3,
      createdAt: new Date()
    };

    if (priority) {
      this.queue.unshift(job); // Add to front for priority
    } else {
      this.queue.push(job);
    }

    console.log(`📬 Queued invoice email job ${job.id} for ${to} (Queue size: ${this.queue.length})`);
    return job.id;
  }

  /**
   * Add other email types to queue
   */
  async queueEmail(
    type: EmailJob['type'],
    to: string,
    data: any,
    pdfBuffer?: Buffer
  ): Promise<string> {
    const job: EmailJob = {
      id: this.generateJobId(),
      type,
      to,
      data,
      pdfBuffer,
      retries: 0,
      maxRetries: 3,
      createdAt: new Date()
    };

    this.queue.push(job);
    console.log(`📬 Queued ${type} email job ${job.id} for ${to} (Queue size: ${this.queue.length})`);
    return job.id;
  }

  /**
   * Process email queue in background
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(async () => {
      if (!this.processing && this.queue.length > 0) {
        await this.processQueue();
      }
    }, 1000); // Process every second

    console.log('📮 Email queue processor started');
  }

  /**
   * Process queued emails
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      const job = this.queue.shift();
      if (!job) {
        return;
      }

      console.log(`📤 Processing email job ${job.id} (${job.type}) for ${job.to}`);
      const startTime = Date.now();

      const emailService = getEmailService();
      let success = false;

      try {
        switch (job.type) {
          case 'invoice':
            success = await emailService.sendInvoiceEmail(job.to, job.data, job.pdfBuffer!);
            break;
          case 'receipt':
            success = await emailService.sendReceiptEmail(job.to, job.data, job.pdfBuffer!);
            break;
          case 'welcome':
            success = await emailService.sendWelcomeEmail(job.to, job.data.userName);
            break;
          case 'verification':
            success = await emailService.sendEmailVerificationEmail(job.to, job.data.token, job.data.userName);
            break;
          case 'reminder':
            success = await emailService.sendInvoiceReminder(
              job.to,
              job.data.invoiceNumber,
              job.data.dueDate,
              job.data.amount,
              job.data.customerName
            );
            break;
          default:
            console.error(`❌ Unknown email job type: ${job.type}`);
            success = false;
        }

        const endTime = Date.now();
        
        if (success) {
          console.log(`✅ Email job ${job.id} completed successfully in ${endTime - startTime}ms`);
        } else {
          throw new Error('Email sending failed');
        }

      } catch (error) {
        console.error(`❌ Email job ${job.id} failed:`, error);
        
        // Retry logic
        if (job.retries < job.maxRetries) {
          job.retries++;
          job.scheduledAt = new Date(Date.now() + (job.retries * 30000)); // Exponential backoff
          this.queue.push(job); // Re-queue for retry
          console.log(`🔄 Retrying email job ${job.id} (attempt ${job.retries}/${job.maxRetries})`);
        } else {
          console.error(`💀 Email job ${job.id} failed permanently after ${job.maxRetries} retries`);
        }
      }

    } catch (error) {
      console.error('❌ Error processing email queue:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { queueSize: number; processing: boolean } {
    return {
      queueSize: this.queue.length,
      processing: this.processing
    };
  }

  /**
   * Clear queue (for testing/emergency)
   */
  clearQueue(): void {
    this.queue = [];
    console.log('🗑️ Email queue cleared');
  }

  /**
   * Stop processing
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('🛑 Email queue processor stopped');
    }
  }

  private generateJobId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default EmailQueueService;
