export interface MessageRead {
  id: number;
  content: string;
  is_user: boolean;
  timestamp: string;
  owner_id: number;
  chat_session_id: number;
}

export interface MessageCreate {
  content: string;
  is_user?: boolean;
}

export interface MessageUpdate {
  content: string;
}
