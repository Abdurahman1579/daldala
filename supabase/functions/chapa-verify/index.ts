// supabase/functions/chapa-verify/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  console.log('=== CHAPA-VERIFY INVOKED ===');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tx_ref, orderId } = await req.json();

    if (!tx_ref || !orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const CHAPA_SECRET = Deno.env.get('CHAPA_SECRET_KEY');
    if (!CHAPA_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const verifyRes = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${CHAPA_SECRET}` },
    });

    const verifyData = await verifyRes.json();
    console.log('Verify:', JSON.stringify(verifyData));

    if (!verifyRes.ok || verifyData.status !== 'success') {
      return new Response(
        JSON.stringify({ error: 'Verify failed', details: verifyData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chapaStatus = verifyData.data?.status;
    const isPaid = chapaStatus === 'success';

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('dh_orders')
      .update({
        status: isPaid ? 'processing' : 'pending',
        payment_status: isPaid ? 'paid' : 'failed',
        payment_ref: tx_ref,
        paid_at: isPaid ? new Date().toISOString() : null,
      })
      .eq('id', orderId);

    return new Response(
      JSON.stringify({
        success: true,
        paid: isPaid,
        chapa_status: chapaStatus,
        tx_ref: tx_ref,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('ERROR:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});