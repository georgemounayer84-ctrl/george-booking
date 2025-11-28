import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const CORS_HEADERS = {
  "content-type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,authorization,apikey,x-api-key,x-action",
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
      const obj: Record<string,string> = {};
      for (const [k,v] of params.entries()) obj[k]=v;
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
    if (req.method === "GET" && (pathname === "" || pathname === "/bookings" || pathname === "/")) {
      const restaurant_id = url.searchParams.get("restaurant_id");
      let q = supabase.from('bookings').select('*').order('reserved_at', { ascending: true });
      if (restaurant_id) q = q.eq('restaurant_id', restaurant_id);
      const { data, error } = await q;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
      return new Response(JSON.stringify({ data }), { status: 200, headers: CORS_HEADERS });
    }

    if (req.method === "POST" && (pathname === "" || pathname === "/bookings" || pathname === "/")) {
      const body = await parseBody(req);

      const action =
        body.action ||
        url.searchParams.get("action") ||
        req.headers.get("x-action") ||
        null;

      const booking_id =
        body.booking_id ||
        body.id ||
        url.searchParams.get("booking_id") ||
        req.headers.get("x-booking-id") ||
        null;

      if (action) {
        if (!booking_id && action !== "create") {
          return new Response(JSON.stringify({ error: "booking_id krävs för action" }), { status: 400, headers: CORS_HEADERS });
        }

        if (action === "cancel") {
          const { data, error } = await supabase
            .from("bookings")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString()
            })
            .eq("id", booking_id)
            .select();

          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
          if (!data || data.length === 0) return new Response(JSON.stringify({ error: "Booking ej hittad" }), { status: 404, headers: CORS_HEADERS });

          return new Response(JSON.stringify({ booking: data[0] }), { status: 200, headers: CORS_HEADERS });
        }

        if (action === "delete") {
          const { data, error } = await supabase
            .from("bookings")
            .delete()
            .eq("id", booking_id)
            .select();

          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
          if (!data || data.length === 0) return new Response(JSON.stringify({ error: "Booking ej hittad" }), { status: 404, headers: CORS_HEADERS });

          return new Response(JSON.stringify({ deleted: data[0] }), { status: 200, headers: CORS_HEADERS });
        }

        if (action === "update" || action === "edit") {
          const allowed = [
            "guest_name",
            "guest_email",
            "guest_phone",
            "covers",
            "reserved_at",
            "notes",
            "status",
            "sitting_id",
            "restaurant_id"
          ];

          const update: Record<string,any> = {};
          allowed.forEach(k => {
            if (body[k] !== undefined && body[k] !== null && body[k] !== "") update[k] = body[k];
          });

          if (Object.keys(update).length === 0) {
            return new Response(JSON.stringify({ error: "Inga giltiga fält att uppdatera" }), { status: 400, headers: CORS_HEADERS });
          }

          const { data, error } = await supabase
            .from("bookings")
            .update(update)
            .eq("id", booking_id)
            .select();

          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
          if (!data || data.length === 0) return new Response(JSON.stringify({ error: "Booking ej hittad" }), { status: 404, headers: CORS_HEADERS });

          return new Response(JSON.stringify({ booking: data[0] }), { status: 200, headers: CORS_HEADERS });
        }

        return new Response(JSON.stringify({ error: "Okänd action" }), { status: 400, headers: CORS_HEADERS });
      }

      const restaurant_id = body.restaurant_id || body.restaurant || null;
      const guest_name = body.guest_name || body.name || null;
      const guest_email = body.guest_email || body.email || null;
      const guest_phone = body.guest_phone || body.phone || null;
      const covers = body.covers || body.party_size || body.covers_count || null;
      const reserved_at = body.reserved_at || body.requested_start || body.start || null;
      const notes = body.notes || body.source || null;

      if (!restaurant_id || !guest_name || !covers || !reserved_at) {
        return new Response(
          JSON.stringify({ error: "restaurant_id, guest_name, covers, reserved_at krävs" }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const { data, error } = await supabase
        .from("bookings")
        .insert([{
          restaurant_id,
          sitting_id: body.sitting_id || null,
          guest_name,
          guest_email,
          guest_phone,
          covers,
          reserved_at,
          notes,
          status: "booked"
        }])
        .select();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: CORS_HEADERS });

      return new Response(JSON.stringify({ booking: data[0] }), { status: 201, headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: CORS_HEADERS });
  }
});
