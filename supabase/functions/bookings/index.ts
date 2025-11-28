// .supabase/functions/bookings/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const CORS_HEADERS = {
  "content-type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/+$/,''); // normalize
  const action = url.searchParams.get('action') || null;

  try {
    // GET /bookings
    if (req.method === "GET" && (pathname === "" || pathname === "/bookings" || pathname === "/")) {
      const restaurant_id = url.searchParams.get("restaurant_id");
      let q = supabase.from('bookings').select('*').order('reserved_at', { ascending: true });
      if (restaurant_id) q = q.eq('restaurant_id', restaurant_id);
      const { data, error } = await q;
      if (error) return new Response(JSON.stringify({ error: error.message || error }), { status: 500, headers: CORS_HEADERS });
      return new Response(JSON.stringify({ data }), { status: 200, headers: CORS_HEADERS });
    }

    // POST with actions (cancel/delete) or create
    if (req.method === "POST" && (pathname === "" || pathname === "/bookings" || pathname === "/")) {
      const payload = await req.json();

      // --- ADMIN ACTIONS ---
      if (action === "cancel") {
        const id = payload.id;
        if (!id) return new Response(JSON.stringify({ error: "id krävs" }), { status: 400, headers: CORS_HEADERS });
        const { data, error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id).select();
        if (error) return new Response(JSON.stringify({ error: error.message || error }), { status: 400, headers: CORS_HEADERS });
        return new Response(JSON.stringify({ booking: data[0] }), { status: 200, headers: CORS_HEADERS });
      }

      if (action === "delete") {
        const id = payload.id;
        if (!id) return new Response(JSON.stringify({ error: "id krävs" }), { status: 400, headers: CORS_HEADERS });
        const { error } = await supabase.from('bookings').delete().eq('id', id);
        if (error) return new Response(JSON.stringify({ error: error.message || error }), { status: 400, headers: CORS_HEADERS });
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // --- CREATE BOOKING (widget / UI) ---
      // Map common widget fields to DB schema
      const restaurant_id = payload.restaurant_id || payload.restaurant || null;
      const guest_name = payload.guest_name || payload.name || null;
      const guest_email = payload.guest_email || payload.email || null;
      const guest_phone = payload.guest_phone || payload.phone || null;
      const covers = payload.covers || payload.party_size || payload.covers_count || null;
      const reserved_at = payload.reserved_at || payload.requested_start || payload.start || null;
      const notes = payload.notes || payload.source || null;

      if (!restaurant_id || !guest_name || !covers || !reserved_at) {
        return new Response(JSON.stringify({ error: "restaurant_id, guest_name, covers, reserved_at krävs" }), { status: 400, headers: CORS_HEADERS });
      }

      const { data, error } = await supabase.from('bookings').insert([{
        restaurant_id,
        sitting_id: payload.sitting_id || null,
        guest_name,
        guest_email,
        guest_phone,
        covers,
        reserved_at,
        notes,
        status: 'booked'
      }]).select();

      if (error) return new Response(JSON.stringify({ error: error.message || error }), { status: 400, headers: CORS_HEADERS });
      return new Response(JSON.stringify({ booking: data[0] }), { status: 201, headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: CORS_HEADERS });
  }
});
