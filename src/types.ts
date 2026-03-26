export interface UserProfile {
  uid: string;
  username: string;
  age: number;
  country: string;
  birthday: string;
  email: string;
  photoURL?: string;
  onboarded: boolean;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt?: string;
  lastMessageAt?: string;
  updatedAt: string;
}

export interface Message {
  id?: string;
  chatId?: string;
  role: 'user' | 'model';
  content: string;
  fileUrl?: string;
  fileName?: string;
  createdAt?: string;
  timestamp: string;
  file?: {
    name: string;
    type: string;
  };
}
