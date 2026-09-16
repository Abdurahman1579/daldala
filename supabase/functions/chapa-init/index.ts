// supabase/functions/chapa-init/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  console.log('=== CHAPA-INIT INVOKED ===');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Body:', JSON.stringify(body));

    const { amount, email, firstName, lastName, phone, orderId } = body;

    if (!amount || !email || !orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const CHAPA_SECRET = Deno.env.get('CHAPA_SECRET_KEY');
    console.log('Secret exists:', !!CHAPA_SECRET);
    console.log('Secret prefix:', CHAPA_SECRET ? CHAPA_SECRET.substring(0, 25) : 'NULL');

    if (!CHAPA_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const txRef = `DALDALA-${orderId.slice(0, 8)}-${Date.now()}`;

    const chapaRes = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHAPA_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'ETB',
        email: email,
        first_name: firstName || 'Customer',
        last_name: lastName || 'User',
        phone_number: phone || '',
        tx_ref: txRef,
        callback_url: 'https://webhook.site',
        return_url: 'https://webhook.site',
        customization: {
          title: 'DaldalaHub',
          description: `Order ${orderId.slice(0, 8)}`,
        },
      }),
    });

    const chapaData = await chapaRes.json();
    console.log('Status:', chapaRes.status);
    console.log('Response:', JSON.stringify(chapaData));

    if (!chapaRes.ok || chapaData.status !== 'success') {
      return new Response(
        JSON.stringify({ error: 'Chapa error', details: chapaData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SUCCESS:', chapaData.data.checkout_url);

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: chapaData.data.checkout_url,
        tx_ref: txRef,
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