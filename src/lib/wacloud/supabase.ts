import { createClient } from '@supabase/supabase-js';
import { WACLOUD_CONFIG } from './config';

export function getWacloudSupabaseAdmin() {
  return createClient(
    WACLOUD_CONFIG.supabaseUrl,
    WACLOUD_CONFIG.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
