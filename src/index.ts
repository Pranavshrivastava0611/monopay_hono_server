import { Hono } from 'hono';
import { getMonoPayData } from '../utils/functions';
import { createClient } from '@supabase/supabase-js';

// 👇 We'll create the Supabase client inside the request handler using env
const app = new Hono<{ Bindings: { SUPABASE_URL_KEY: string; SUPABASE_ANON_KEY: string } }>();

app.get('/service/config', async (c) => {
  const apiKey = c.req.query('apikey');
  console.log(apiKey);
  if (!apiKey) {
    return c.json({ success: false, error: 'Missing API key' }, 400);
  }

  // ⚡ Create Supabase client using Worker env bindings
  const supabase = createClient(c.env.SUPABASE_URL_KEY, c.env.SUPABASE_ANON_KEY);

  // ✅ Pass the supabase client into getMonoPayData
  const result = await getMonoPayData(apiKey, supabase);

  if (!result.success) {
    return c.json(result, 400);
  }

  return c.json(result, 200);
});

export default app;
