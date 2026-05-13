import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { argon2Verify } from "https://esm.sh/hash-wasm@4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CAPTCHA_THRESHOLD = 7; // Require CAPTCHA when remaining attempts < 7

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse and validate request
    const { username, password, captcha_token } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username and password are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create admin client (service role bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3. Check remaining login attempts
    const { data: remainingAttempts } = await supabaseAdmin.rpc(
      'get_remaining_login_attempts',
      { p_username: username }
    );

    const captchaRequired = (remainingAttempts ?? 10) < CAPTCHA_THRESHOLD;

    // 4. If CAPTCHA required, validate token
    if (captchaRequired) {
      if (!captcha_token) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Verification required.',
            remaining_attempts: remainingAttempts ?? 0,
            captcha_required: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate with Cloudflare Turnstile
      const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
      if (turnstileSecret) {
        const verifyRes = await fetch(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              secret: turnstileSecret,
              response: captcha_token,
            }),
          }
        );
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Captcha verification failed.',
              remaining_attempts: remainingAttempts ?? 0,
              captcha_required: true,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 5. Fetch credentials via SECURITY DEFINER function
    const { data: credentials, error: credErr } = await supabaseAdmin.rpc(
      'verify_login_credentials',
      { p_username: username }
    );

    if (credErr) {
      console.error('RPC error:', credErr.message);
      return new Response(
        JSON.stringify({ success: false, error: 'An error occurred.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cred = credentials?.[0];

    // 6. Check if account is locked
    if (cred?.is_locked) {
      return new Response(
        JSON.stringify({ success: false, error: 'Account locked.', is_locked: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. If no credentials found, record failed attempt and return generic error
    if (!cred?.password_hash) {
      await supabaseAdmin.rpc('record_login_attempt', {
        p_username: username,
        p_success: false,
      });

      const { data: updatedRemaining } = await supabaseAdmin.rpc(
        'get_remaining_login_attempts',
        { p_username: username }
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid credentials.',
          remaining_attempts: updatedRemaining ?? 0,
          captcha_required: (updatedRemaining ?? 0) < CAPTCHA_THRESHOLD,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Verify password using hash-wasm argon2Verify
    let isValid = false;
    try {
      isValid = await argon2Verify({
        password: password,
        hash: cred.password_hash,
      });
    } catch (e) {
      console.error('Argon2 verify error:', e);
      isValid = false;
    }

    // 9. Record attempt result
    await supabaseAdmin.rpc('record_login_attempt', {
      p_username: username,
      p_success: isValid,
    });

    // 10. Return result
    if (isValid) {
      // Look up the linked user_id (service role bypasses RLS)
      const { data: linkData } = await supabaseAdmin
        .from('user_recovery_links')
        .select('user_id')
        .eq('recovery_id', cred.recovery_id)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          recovery_id: cred.recovery_id,
          linked_user_id: linkData?.user_id ?? null,
          remaining_attempts: 10, // Reset on success
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const { data: updatedRemaining } = await supabaseAdmin.rpc(
        'get_remaining_login_attempts',
        { p_username: username }
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid credentials.',
          remaining_attempts: updatedRemaining ?? 0,
          captcha_required: (updatedRemaining ?? 0) < CAPTCHA_THRESHOLD,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
