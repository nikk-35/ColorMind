import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://djnzytekbksbpzmkxkmh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqbnp5dGVrYmtzYnB6bWt4a21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjE5MzIsImV4cCI6MjA5MTc5NzkzMn0.Z0H5J8REKnkhrlqzky5iUo4jW352KfeCldDsVu0-ET4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  username: string;
  created_at: string;
};

export type Score = {
  id: string;
  user_id: string;
  username: string;
  score: number;
  mode: string;
  date: string | null;
  created_at: string;
};
