import { json } from '../_shared/supabase.js';

export function onRequestGet() {
  return json({ ok: true, service: 'prepwise-api' });
}
