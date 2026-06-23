import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "https://esm.sh/nodemailer@6.9.8";

const encoder = new TextEncoder();

async function hashCode(code: string, salt?: string) {
  const data = encoder.encode(code + (salt || "ligtas-salt"));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email required" }), { status: 400 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await hashCode(code, Deno.env.get("OTP_SALT"));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("otp_codes").insert({
      email,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    const transport = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") || "smtp-relay.brevo.com",
      port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
      secure: false,
      auth: {
        user: Deno.env.get("SMTP_USER") || "",
        pass: Deno.env.get("SMTP_PASS") || "",
      },
    });

    await transport.sendMail({
      from: '"Ligtas Calbayog" <ligtascalbayog@gmail.com>',
      to: email,
      subject: "Your OTP Code - Ligtas Calbayog",
      html: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:Arial;background:#f5f5f5">
<table width="100%"><tr><td align="center" style="padding:32px 16px">
<table width="480" style="background:#fff;border-radius:12px;padding:32px">
<tr><td style="text-align:center;padding-bottom:24px">
<h1 style="color:#151515;font-size:22px;margin:0">Ligtas Calbayog</h1>
<p style="color:#888;font-size:13px">Your Safety, Our Priority</p></td></tr>
<tr><td style="text-align:center;padding:16px 0">
<div style="background:#f5f5f5;border-radius:12px;padding:20px 32px;font-size:36px;letter-spacing:10px;font-weight:700;color:#151515">${code}</div></td></tr>
<tr><td style="text-align:center"><p style="color:#888;font-size:12px">Code expires in 10 min</p></td></tr>
</table></td></tr></table></body></html>`,
    });

    return new Response(JSON.stringify({ sent: true, dev_code: code }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
