// API contract types — mirror backend exactly. Do not invent fields.

export type LotStatus = 'ACTIVE' | 'DRAFT' | 'SOLD' | 'UNSOLD' | 'CANCELLED';

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
  avatar_url?: string | null;
  bio?: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface Lot {
  id: number;
  title: string;
  description: string;
  start_price: number;
  current_price: number;
  min_step: number;
  status: LotStatus;
  start_time: string | null;
  end_time: string | null;
  owner_id: number;
  creator_id: number;
  winner_id: number | null;
  created_at: string;
  image_url?: string | null;
}

// Lot detail may include leader identity when backend provides it.
export interface LotDetail extends Lot {
  leader?: {
    id: number;
    username: string;
  } | null;
  current_leader_id?: number | null;
  current_leader_username?: string | null;
}

export interface CreateLotPayload {
  title: string;
  description: string;
  start_price: number;
  min_step: number;
  start_time?: string;
  end_time?: string;
  image_url?: string | null;
}

export type UpdateLotPayload = Partial<{
  title: string;
  description: string;
  start_price: number;
  min_step: number;
  start_time: string | null;
  end_time: string | null;
  image_url: string | null;
}>;

export interface UpdateUserPayload {
  bio?: string | null;
  avatar_url?: string | null;
}

export interface Bid {
  id: number;
  lot_id: number;
  user_id: number;
  amount: number;
  created_at: string;
  // Backend may decorate with relations
  lot?: Pick<Lot, 'id' | 'title' | 'status'>;
  user?: Pick<User, 'id' | 'username'>;
}

// WebSocket inbound message union
export type WsInboundMessage =
  | {
      type: 'STATE_UPDATE';
      lot: {
        id: number;
        current_price: number | string;
        current_leader_id?: number | null;
        current_leader_username?: string | null;
      };
    }
  | { type: 'AUCTION_FINISHED'; lot_id: number; status: 'sold' | 'unsold' }
  | { type: 'BID_ERROR'; message: string };

// WebSocket outbound message
export interface WsOutboundBid {
  type: 'PLACE_BID';
  amount: number;
}

export interface ApiError {
  detail: string;
  status: number;
}

// Response shape from file-upload endpoints (/lots/{id}/upload-image, /auth/me/avatar)
export interface UploadImageResponse {
  url: string;
}
