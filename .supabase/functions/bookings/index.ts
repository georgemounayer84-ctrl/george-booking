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
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,PATCH,DELETE"
};

async function parseBody(req: Request) {
  try {
    const text = await req.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      const params = new URLSearchParams(text);
      const obj: Record<string, any> = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return obj;
    }
  } catch {
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/+$/,'');

  try {
    // GET - lista bokningar
    if (req.method === "GET" && (pathname === "" || pathname === "/bookings" || pathname === "/")) {
      const restaurant_id = url.searchParams.get("restaurant_id");
      let q = supabase.from('bookings').select('*').order('reserved_at', { ascending: true });
      if (restaurant_id) q = q.eq('restaurant_id', restaurant_id);
      const { data, error } = await q;
      if (error) return new Response(JSON.stringify({ error: error.message || error }), { status: 500, headers: CORS_HEADERS });
      return new Response(JSON.stringify({ data }), { status: 200, headers: CORS_HEADERS });
    }

    // POST - create eller admin actions
    if (req.method === "POST" && (pathname === "" || pathname === "/bookings" || pathname === "/")) {
      const bodyPayload = await parseBody(req);

      const action = (bodyPayload && bodyPayload.action)
        || url.searchParams.get("action")
        || req.headers.get("x-action")
        || null;

      const booking_id = (bodyPayload && (bodyPayload.booking_id || bodyPayload.id))
        || url.searchParams.get("booking_id")
        || req.headers.get("x-booking-id")
        || null;

      // ADMIN ACTIONS
      if (action) {
        if (!booking_id && action !== "create") {
          return new Response(JSON.stringify({ error: "booking_id krävs för action" }), { status: 400, headers: CORS_HEADERS });
        }

        // CANCEL
        if (action === "cancel") {
          const { data, error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
            .eq('id', booking_id)
            .select();
          if (error) return new Response(JSON.stringify({ error: error.message || error }), { status: 500, headers: CORS_HEADERS });
          if (!data || data.length === 0) return new Response(JSON.stringify({ error: "Booking ej hittad" }), { status: 404, headers: CORS_HEADERS });
          return new Response(JSON.stringify({ booking: data[0] }), { status: 200, headers: CORS_HEADERS });
        }

        // DELETE (hard delete)
        if (action === "delete") {
          const { data, error } = await supabase
            .from('bookings')
            .delete()
            .eq('id', booking_id)
            .select();
          if (error) return new Response(JSON.stringify({ error: error.message || error }), { status: 500, headers: CORS_HEADERS });
          if (!data || data.length === 0) return new Response(JSON.stringify({ error: "Booking ej hittad" }), { status: 404, headers: CORS_HEADERS });
          return new Response(JSON.stringify({ deleted: data[0] }), { status: 200, headers: CORS_HEADERS });
        }

        // UPDATE / EDIT
        if (action === "update" || action === "edit") {
          // tillåt att klient skickar vilka fält som ska uppdateras
          const updatable: Record<string, any> = {};
          const allowed = ['guest_name','guest_email','guest_phone','covers','reserved_at','notes','status','sitting_id','restaurant_id'];
          for (const k of allowed) {
            if (bodyPayload[k] !== undefined && bodyPayload[k] !== null) updatable[k] = bodyPayload[k];
          }
          if (Object.keys(updatable).length === 0) {
            return new Response(JSON.stringify({ error: "Inga giltiga fält att uppdatera" }), { status: 400, headers: CORS_HEADERS });
          }

          const { data, error } = await supabase
            .from('bookings')
            .update(updatable)
            .eq('id', booking_id)
            .select();
          if (error) return new Response(JSON.stringify({ error: error.message || error }), { status: 500, headers: CORS_HEADERS });
          if (!data || data.length === 0) return new Response(JSON.stringify({ error: "Booking ej hittad" }), { status: 404, headers: CORS_HEADERS });
          return new Response(JSON.stringify({ booking: data[0] }), { status: 200, headers: CORS_HEADERS });
        }

        return new Response(JSON.stringify({ error: "Okänd action" }), { status: 400, headers: CORS_HEADERS });
      }

      // CREATE (widget)
      const payload = bodyPayload || {};

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
