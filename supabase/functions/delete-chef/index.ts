import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'Server environment is incomplete.' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization.' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Not authenticated.' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRole);
  const { data: profile } = await adminClient.from('profiles').select('role,active').eq('id', user.id).maybeSingle();
  if (!profile || profile.active !== true || profile.role !== 'admin') return json({ error: 'Administrator access is required.' }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body.' }, 400); }
  const targetId = String(body?.id || '').trim();
  if (!targetId) return json({ error: 'A staff id is required.' }, 400);
  if (targetId === user.id) return json({ error: 'You cannot delete your own account.' }, 400);

  const { data: target } = await adminClient.from('profiles').select('role').eq('id', targetId).maybeSingle();
  if (target?.role === 'admin') return json({ error: 'Admin accounts cannot be deleted here.' }, 400);

  // Deleting the auth user also removes their profiles row automatically
  // (profiles.id references auth.users(id) on delete cascade).
  const { error } = await adminClient.auth.admin.deleteUser(targetId);
  if (error) return json({ error: error.message }, 400);

  return json({ success: true });
});
