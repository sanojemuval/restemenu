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
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const full_name = String(body?.full_name || '').trim();
  const role = String(body?.role || 'chef');
  if (!email || !password || !full_name) return json({ error: 'Full name, email and password are required.' }, 400);
  if (!['chef', 'kitchen_staff', 'manager'].includes(role)) return json({ error: 'Invalid staff role.' }, 400);
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters.' }, 400);

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name }
  });
  if (error) return json({ error: error.message }, 400);
  if (!data.user) return json({ error: 'User was not created.' }, 500);

  const { error: profileError } = await adminClient.from('profiles').update({ full_name, email, role, active: true, updated_at: new Date().toISOString() }).eq('id', data.user.id);
  if (profileError) {
    await adminClient.auth.admin.deleteUser(data.user.id);
    return json({ error: `User was created but staff profile failed: ${profileError.message}` }, 500);
  }

  return json({ success: true, id: data.user.id });
});
