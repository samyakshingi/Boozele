import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Polyfill WebSocket in Node.js environment (SSR)
if (typeof window === 'undefined') {
  try {
    global.WebSocket = require('ws');
  } catch (err) {
    console.warn('ws module not found for global WebSocket polyfill');
  }
}

// Memory storage fallback for Server-Side Rendering
class MemoryStorage {
  private data: Record<string, string> = {};
  async getItem(key: string): Promise<string | null> {
    return this.data[key] || null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.data[key] = value;
  }
  async removeItem(key: string): Promise<void> {
    delete this.data[key];
  }
}

// Dynamically load AsyncStorage to prevent SSR window reference error
const getStorage = () => {
  if (typeof window !== 'undefined') {
    return require('@react-native-async-storage/async-storage').default;
  }
  return new MemoryStorage();
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
