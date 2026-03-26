import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

// Initialize Supabase client
// Note: This will only work if the user provides valid credentials in the Secrets panel.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Hybrid Storage: Fallback to LocalStorage if Supabase is not configured
export const syncToCloud = async (log: any) => {
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const { error } = await supabase.from('chat_logs').insert([log]);
      if (!error) return true;
    } catch (e) {
      console.warn('Cloud sync failed, falling back to local storage.');
    }
  }
  
  // Local Fallback
  const localLogs = JSON.parse(localStorage.getItem('garuan_chat_logs') || '[]');
  localLogs.push({ ...log, id: Date.now(), created_at: new Date().toISOString() });
  localStorage.setItem('garuan_chat_logs', JSON.stringify(localLogs.slice(-100))); // Keep last 100
  return true;
};

export const testSupabaseConnection = async () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return true; // Return true to indicate "Local Mode" is active
  }
  try {
    const { error } = await supabase.from('chat_logs').select('id').limit(1);
    if (error && error.code === '42P01') return false;
    return true;
  } catch (err) {
    return false;
  }
};
