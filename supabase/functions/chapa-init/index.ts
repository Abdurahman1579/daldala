// supabase/functions/chapa-init/index.ts
// Chapa Payment Initialization — Supabase Edge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ⚠️ URL KEE — webhook.site irraa
const WEBHOOK_URL = 'https://webhook.site/6aac2cb4-0cd5-4e50-8b90-f484b2f52c6f';

serve(async (req) => {
  console.log('=== CHAPA-INIT INVOKED ===');
  console.log('Method:', req.method);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    console.log('Body received:', bodyText);

    const { amount, email, firstName, lastName, phone, orderId } = JSON.parse(bodyText);

    console.log('Parsed:', { amount, email, orderId });

    // Validation
    if (!amount || !email || !orderId) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: amount, email, orderId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chapa Secret Key — Environment Variable irraa
    const CHAPA_SECRET = Deno.env.get('CHAPA_SECRET_KEY');
    console.log('CHAPA_SECRET exists:', !!CHAPA_SECRET);
    console.log('CHAPA_SECRET prefix:', CHAPA_SECRET ? CHAPA_SECRET.substring(0, 25) : 'NULL');

    if (!CHAPA_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Chapa secret key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique tx_ref
    const txRef = `DALDALA-${orderId.slice(0, 8)}-${Date.now()}`;
    console.log('tx_ref:', txRef);

    // Chapa API — Initialize Payment
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
        callback_url: WEBHOOK_URL,
        return_url: WEBHOOK_URL,
        customization: {
          title: 'DaldalaHub',
          description: `Payment for order ${orderId.slice(0, 8)}`,
        },
      }),
    });

    const chapaData = await chapaRes.json();
    console.log('Chapa status:', chapaRes.status);
    console.log('Chapa response:', JSON.stringify(chapaData));

    if (!chapaRes.ok || chapaData.status !== 'success') {
      console.error('Chapa API error');
      return new Response(
        JSON.stringify({ error: 'Chapa API error', details: chapaData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SUCCESS — checkout_url:', chapaData.data.checkout_url);

    // Response — checkout_url, tx_ref
    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: chapaData.data.checkout_url,
        tx_ref: txRef,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('FUNCTION ERROR:', err.message);
    console.error('Stack:', err.stack);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});