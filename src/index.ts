import { Hono } from 'hono';
import { getMonoPayData } from '../utils/functions';
import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';

// 👇 We'll create the Supabase client inside the request handler using env
const app = new Hono<{ Bindings: { SUPABASE_URL_KEY: string; SUPABASE_ANON_KEY: string,RPC_URL_API:string} }>();

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

app.post('/verify', async (c) => {
  try {
    const { txSignature, serviceId, payoutWallet, priceLamports } = await c.req.json();

    if (!txSignature || !payoutWallet || !priceLamports) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    // 1️⃣ Connect to Solana
    const connection = new Connection(`https://devnet.helius-rpc.com/?api-key=${c.env.RPC_URL_API}`);

    // 2️⃣ Fetch transaction details
    const tx = await connection.getTransaction(txSignature, {
      commitment: 'finalized',
    });

    if (!tx) {
      return c.json({ success: false, error: 'Transaction not found' }, 404);
    }

    // 3️⃣ Check for transaction errors
    if (tx.meta?.err) {
      return c.json({ success: false, error: 'Transaction failed on-chain' }, 400);
    }

    // 4️⃣ Get account balances before and after the transaction
    const accountKeys = tx.transaction.message.accountKeys.map((key) => key.toBase58());
    const index = accountKeys.indexOf(payoutWallet);

    if (index === -1) {
      return c.json({ success: false, error: 'Payout wallet not in transaction' }, 400);
    }

    const pre = BigInt(tx.meta!.preBalances[index]);
    const post = BigInt(tx.meta!.postBalances[index]);
    const received = post - pre;

    if (received < BigInt(priceLamports)) {
      return c.json({
        success: false,
        error: `Insufficient payment: expected ${priceLamports}, got ${received.toString()}`,
      });
    }

    // ✅ 5️⃣ Return success if everything is valid
    return c.json({
      success: true,
      data: {
        txSignature,
        serviceId,
        payoutWallet,
        received: received.toString(),
      },
    });
  } catch (err) {
    console.error('Error verifying payment:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export default app;
