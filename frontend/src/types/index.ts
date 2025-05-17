export type RSVPStatus = 'going' | 'maybe' | 'not_going' | 'pending' | 'waitlist';

export type UserRole = 'planner' | 'guest' | 'viewer';

export type User = {
  uid: string;
  phoneNumber?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  created_at?: string;
};

export type Trip = {
  id: string;
  name: string;
  description?: string;
  location: string;
  start_date: string;
  end_date: string;
  guest_limit?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: TripMember[];
  cover_photo_url?: string;
  cover_photo_path?: string;
};

export type TripMember = {
  id: string;
  trip_id: string;
  user_id: string;
  user?: User;
  rsvp_status: RSVPStatus;
  role: UserRole;
  waitlist_position?: number | null;
  invited_by?: string;
  invited_at?: string;
  responded_at?: string;
};

export type TravelDocument = {
  id: string;
  trip_id: string;
  user_id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type: string;
  uploaded_at: string;
};

export type AccommodationDocument = {
  id: string;
  trip_id: string;
  user_id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type: string;
  uploaded_at: string;
};

export type ItineraryDay = {
  id: string;
  trip_id: string;
  date: string;
  items: ItineraryItem[];
};

export type ItineraryItem = {
  id: string;
  day_id: string;
  date: string;
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  order: number;
};

export type TodoItem = {
  id: string;
  trip_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  is_completed: boolean;
  due_date?: string;
  created_by: string;
  created_at: string;
};

export type MapLocation = {
  id: string;
  trip_id: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  category: 'food' | 'activity' | 'accommodation' | 'transportation' | 'other';
  added_by: string;
  added_at: string;
};

export type Expense = {
  id: string;
  trip_id: string;
  title: string;
  amount: number;
  currency: string;
  paid_by: string;
  paid_at: string;
  split_between: ExpenseSplit[];
  category?: string;
  receipt?: string;
};

export type ExpenseSplit = {
  user_id: string;
  amount: number;
  is_paid: boolean;
};

export type Message = {
  id: string;
  trip_id: string;
  user_id: string;
  content: string;
  sent_at: string;
  reactions: Reaction[];
};

export type Reaction = {
  user_id: string;
  emoji: string;
};

export type Poll = {
  id: string;
  trip_id: string;
  title: string;
  description?: string;
  options: PollOption[];
  created_by: string;
  created_at: string;
  ends_at?: string;
  is_active: boolean;
};

export type PollOption = {
  id: string;
  text: string;
  votes: string[]; // userIds who voted for this option
};

export type ActivityFeedItem = {
  id: string;
  trip_id: string;
  user_id: string;
  type: 'rsvp_change' | 'document_upload' | 'itinerary_update' | 'todo_complete' | 'expense_added' | 'new_guest' | 'poll_created' | 'poll_ended' | 'message';
  content: string;
  timestamp: string;
  metadata?: any;
};

export type Document = {
  id: string;
  trip_id: string;
  user_id: string;
  name: string;
  description?: string;
  file_url: string;
  file_type: string;
  file_size: number;
  document_type: 'travel' | 'accommodation';
  is_public: boolean;
  created_at: string;
  updated_at?: string;
};