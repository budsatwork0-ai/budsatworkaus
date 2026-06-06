// src/types/messaging.ts
// Unified Messaging System — admin-only internal hub.

export type EntityType = 'customer' | 'crew' | 'lead' | 'applicant';

export type ConversationStatus = 'open' | 'closed' | 'archived';

export type MessageChannel = 'internal' | 'sms' | 'email';

export type DeliveryStatus = 'draft' | 'queued' | 'sent' | 'delivered' | 'failed';

export type SenderType = 'admin' | 'entity';

export interface Conversation {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  subject: string | null;
  status: ConversationStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from the relevant entity table — populated by the API, not stored in DB */
  entity_display_name?: string;
  /** Latest message preview — populated by the API */
  last_message?: string | null;
  /** Unread count — populated by the API */
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  body: string;
  channel: MessageChannel;
  delivery_status: DeliveryStatus;
  created_at: string;
  /** Display name resolved from sender_id — populated by the API */
  sender_display_name?: string;
}

export interface CreateConversationInput {
  entity_type: EntityType;
  entity_id: string;
  subject?: string;
}

export interface SendMessageInput {
  conversation_id: string;
  body: string;
  channel?: MessageChannel;
}

/** Passed from entity pages to open MessagingHub in scoped mode */
export interface EntityContext {
  entity_type: EntityType;
  entity_id: string;
  display_name: string;
}
