import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SEND_OTP_QUERY = `
INSERT INTO otp_codes (email, code_hash, expires_at)
VALUES ($1, $2, $3)
`;

serve(async (req) => {
  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email required" }), { status: 400 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const encoder = new TextEncoder();
    const data = encoder.encode(code + Deno.env.get("OTP_SALT")!);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const codeHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: dbError } = await supabase.rpc("exec_sql", {
      query: SEND_OTP_QUERY,
      params: [email, codeHash, expiresAt],
    });

    if (dbError) {
      const { error: insertError } = await supabase.from("otp_codes").insert({
        email,
        code_hash: codeHash,
        expires_at: expiresAt,
      });
      if (insertError) throw insertError;
    }

    console.log(`[DEV] OTP for ${email}: ${code}`);

    return new Response(JSON.stringify({ sent: true, dev_code: code }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
