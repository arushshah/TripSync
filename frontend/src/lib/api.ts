import { auth } from './firebase';

/**
 * TripSync API Client
 * Centralized utility for making API calls to the Flask backend
 */
export class ApiClient {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5555';
  }
  
  /**
   * Get the Firebase ID token for authentication
   */
  private async getIdToken(): Promise<string | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return null;
    }
    
    try {
      const token = await currentUser.getIdToken();
      return token;
    } catch (error) {
      console.error("Error getting authentication token:", error);
      return null;
    }
  }
  
  /**
   * Make an authenticated API request
   */
  private async request<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    const token = await this.getIdToken();
    
    if (!token) {
      throw new Error('Authentication required. Please log in.');
    }
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    
    const config: RequestInit = {
      method,
      headers,
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api${endpoint}`, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      const result = await response.json();
      return result as T;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Make an unauthenticated API request (for endpoints that don't require auth like registration)
   */
  private async unauthenticatedRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    const config: RequestInit = {
      method,
      headers,
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api${endpoint}`, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      const result = await response.json();
      return result as T;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Add a post method that doesn't require authentication
  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.unauthenticatedRequest<T>(endpoint, 'POST', data);
  }
  
  // Trip endpoints
  async getTrips() {
    return this.request<any[]>('/trips');
  }
  
  async getInvitations() {
    return this.request<any[]>('/trips/invitations');
  }
  
  async getTripById(tripId: string) {
    return this.request<any>(`/trips/${tripId}`);
  }
  
  async createTrip(tripData: any) {
    return this.request<any>('/trips', 'POST', tripData);
  }
  
  async updateTrip(tripId: string, tripData: any) {
    return this.request<any>(`/trips/${tripId}`, 'PUT', tripData);
  }
  
  async deleteTripById(tripId: string) {
    return this.request<void>(`/trips/${tripId}`, 'DELETE');
  }
  
  async getTripInviteInfo(tripId: string) {
    return this.request<any>(`/trips/${tripId}/invite-info`);
  }
  
  async generateTripInvite(tripId: string) {
    return this.request<any>(`/trips/${tripId}/invite`, 'POST');
  }
  
  // RSVP endpoints
  async respondToInvitation(tripId: string, status: string) {
    return this.request<any>(`/rsvp/${tripId}`, 'POST', { status });
  }
  
  async updateRSVPStatus(tripId: string, memberId: string, status: string) {
    return this.request<any>(`/rsvp/${tripId}/update`, 'POST', { 
      member_id: memberId,
      status 
    });
  }
  
  async getRsvpSummary(tripId: string) {
    return this.request<any>(`/rsvp/summary/${tripId}`);
  }
  
  // Itinerary endpoints
  async getItinerary(tripId: string) {
    return this.request<any>(`/itinerary/${tripId}`);
  }
  
  async generateItinerary(tripId: string) {
    return this.request<any>(`/itinerary/${tripId}/generate`, 'POST');
  }
  
  async createItineraryItem(tripId: string, itemData: any) {
    return this.request<any>(`/itinerary/${tripId}`, 'POST', itemData);
  }
  
  async updateItineraryItem(tripId: string, itemId: string, updates: any) {
    return this.request<any>(`/itinerary/${tripId}/${itemId}`, 'PUT', updates);
  }
  
  async deleteItineraryItem(tripId: string, itemId: string) {
    return this.request<void>(`/itinerary/${tripId}/${itemId}`, 'DELETE');
  }
  
  // Document endpoints
  async getTravelDocuments(tripId: string) {
    return this.request<any>(`/documents/travel/${tripId}`);
  }
  
  async getAccommodationDocuments(tripId: string) {
    return this.request<any>(`/documents/accommodation/${tripId}`);
  }

  async getDocuments(tripId: string, documentType: string) {
    return this.request<Document[]>(`/documents/${tripId}?type=${documentType}`);
  }
  
  async uploadDocument(tripId: string, documentData: any) {
    return this.request<Document>(`/documents/${tripId}`, 'POST', documentData);
  }
  
  async updateDocument(tripId: string, documentId: string, updates: any) {
    return this.request<Document>(`/documents/${tripId}/${documentId}`, 'PUT', updates);
  }
  
  async deleteDocument(tripId: string, documentId: string) {
    return this.request<void>(`/documents/${tripId}/${documentId}`, 'DELETE');
  }
  
  // Todo endpoints
  async getTodos(tripId: string) {
    return this.request<any>(`/todos/${tripId}`);
  }
  
  async createTodo(tripId: string, todoData: any) {
    return this.request<any>(`/todos/${tripId}`, 'POST', todoData);
  }
  
  async updateTodoStatus(tripId: string, todoId: string, isCompleted: boolean) {
    return this.request<any>(`/todos/${tripId}/${todoId}`, 'PUT', { is_completed: isCompleted });
  }

  async getTripTodos(tripId: string) {
    return this.request<any[]>(`/todos/${tripId}`);
  }
  
  async createTripTodo(tripId: string, todoData: any) {
    return this.request<any>(`/todos/${tripId}`, 'POST', todoData);
  }
  
  async updateTripTodo(tripId: string, todoId: string, updates: any) {
    return this.request<any>(`/todos/${tripId}/${todoId}`, 'PUT', updates);
  }
  
  async deleteTripTodo(tripId: string, todoId: string) {
    return this.request<void>(`/todos/${tripId}/${todoId}`, 'DELETE');
  }
  
  async completeTripTodo(tripId: string, todoId: string) {
    return this.request<any>(`/todos/${tripId}/${todoId}/complete`, 'POST');
  }
  
  async uncompleteTripTodo(tripId: string, todoId: string) {
    return this.request<any>(`/todos/${tripId}/${todoId}/uncomplete`, 'POST');
  }
  
  async getMyTripTodos(tripId: string) {
    return this.request<any[]>(`/todos/${tripId}/assigned-to-me`);
  }
  
  // Map endpoints
  async getMapLocations(tripId: string) {
    return this.request<any>(`/map/${tripId}`);
  }
  
  async addMapLocation(tripId: string, locationData: any) {
    return this.request<any>(`/map/${tripId}`, 'POST', locationData);
  }
  
  // Expense endpoints
  async getExpenses(tripId: string) {
    return this.request<any>(`/expenses/${tripId}`);
  }
  
  async addExpense(tripId: string, expenseData: any) {
    return this.request<any>(`/expenses/${tripId}`, 'POST', expenseData);
  }
  
  // Poll endpoints
  async getPolls(tripId: string) {
    return this.request<any>(`/polls/${tripId}`);
  }
  
  async createPoll(tripId: string, pollData: any) {
    return this.request<any>(`/polls/${tripId}`, 'POST', pollData);
  }
  
  async voteOnPoll(tripId: string, pollId: string, optionId: string) {
    return this.request<any>(`/polls/${tripId}/${pollId}/vote`, 'POST', { option_id: optionId });
  }
  
  // User endpoints
  async getUserProfile() {
    return this.request<any>('/users/profile');
  }
  
  async updateUserProfile(profileData: any) {
    return this.request<any>('/users/profile', 'PUT', profileData);
  }
  
  // Check if phone number exists
  async checkPhoneExists(phoneNumber: string) {
    return this.unauthenticatedRequest<{exists: boolean}>('/users/check-phone', 'POST', { phone_number: phoneNumber });
  }
}

// Create a singleton instance
export const api = new ApiClient();

export default api;