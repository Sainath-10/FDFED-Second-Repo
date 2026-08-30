import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { FileLoggerService } from '@/common/logger/file-logger.service';

/**
 * B2B Consume — Webhook Notifier Service
 *
 * When your system creates a competition, it notifies an external
 * partner system via an HTTP POST (webhook). This is the classic
 * B2B "event push" pattern — your backend CONSUMES an external API.
 *
 * In production this URL would point to a real partner's endpoint.
 * For demo, it posts to a public test server (jsonplaceholder.typicode.com).
 */
@Injectable()
export class WebhookNotifierService {
  private readonly webhookUrl =
    process.env.WEBHOOK_URL || 'https://jsonplaceholder.typicode.com/posts';

  constructor(private readonly fileLogger: FileLoggerService) {}

  /**
   * Fire-and-forget: notify external partner of a new competition.
   * Errors are logged but do NOT fail the main request.
   */
  async notifyCompetitionCreated(competition: {
    id: string;
    name: string;
    status: string;
    startDate: Date;
    endDate: Date;
    createdBy: string;
  }): Promise<void> {
    const payload = {
      event: 'COMPETITION_CREATED',
      source: 'FDFED-Competition-System',
      timestamp: new Date().toISOString(),
      data: competition,
    };

    this.fileLogger.log(
      `[B2B-WEBHOOK] Dispatching event to external partner: ${this.webhookUrl}`,
      'WebhookNotifier',
      { event: payload.event, competitionId: competition.id },
    );

    try {
      const response = await axios.post(this.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      this.fileLogger.log(
        `[B2B-WEBHOOK] Partner notified successfully. Status: ${response.status}`,
        'WebhookNotifier',
        { competitionId: competition.id, httpStatus: response.status },
      );
    } catch (err) {
      // Non-blocking — log error but don't throw
      this.fileLogger.warn(
        `[B2B-WEBHOOK] Failed to notify partner: ${err.message}`,
        'WebhookNotifier',
        { competitionId: competition.id, error: err.message },
      );
    }
  }
}
