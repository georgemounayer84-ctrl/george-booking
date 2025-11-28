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

serve(async (req) => {
  const url = new URL(req.url);
  try {
    // GET /bookings?restaurant_id=...
    if (req.method === "GET" && url.pathname === "/bookings") {
      const restaurant_id = url.searchParams.get("restaurant_id");
      let q = supabase.from('bookings').select('*').order('reserved_at');
      if (restaurant_id) q = q.eq('restaurant_id', restaurant_id);
      const { data, error } = await q;
      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: {"content-type":"application/json"} });
      return new Response(JSON.stringify(data), { status: 200, headers: {"content-type":"application/json"} });
    }

    // POST /bookings
    if (req.method === "POST" && url.pathname === "/bookings") {
      const payload = await req.json();
      // minimal validation
      if (!payload.restaurant_id || !payload.guest_name || !payload.covers || !payload.reserved_at) {
        return new Response(JSON.stringify({ error: "restaurant_id, guest_name, covers, reserved_at krävs" }), { status: 400, headers: {"content-type":"application/json"} });
      }
      const { data, error } = await supabase.from('bookings').insert([{
        restaurant_id: payload.restaurant_id,
        sitting_id: payload.sitting_id || null,
        guest_name: payload.guest_name,
        guest_email: payload.guest_email || null,
        guest_phone: payload.guest_phone || null,
        covers: payload.covers,
        reserved_at: payload.reserved_at,
        notes: payload.notes || null,
        status: 'booked'
      }]).select();
      if (error) return new Response(JSON.stringify({ error }), { status: 400, headers: {"content-type":"application/json"} });
      return new Response(JSON.stringify(data[0]), { status: 201, headers: {"content-type":"application/json"} });
    }

    return new Response("Not found", { status: 404 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: {"content-type":"application/json"} });
  }
});
