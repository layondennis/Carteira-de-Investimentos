import { createClient } from '@supabase/supabase-js';

// Substitua pelas suas credenciais do painel do Supabase (Settings > API)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zstoedyyqbviugqoycow.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_hGfxIFcDFAfy0EIKhOCKbA_KGYfvZ8A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
