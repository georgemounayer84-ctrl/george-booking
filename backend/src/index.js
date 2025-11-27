// backend/src/index.js
// ------------------------------------------------------
// Express API för George Booking — Supabase version
// ------------------------------------------------------

const express = require('express');
const cors = require('cors');
const { supabase } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());


// ------------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------------
app.get('/api/v1/health', (req, res) => {
  res.json({ ok: true, service: 'george-booking-backend', supabase: true });
});


// ------------------------------------------------------
// LIST RESTAURANTS
// ------------------------------------------------------
app.get('/api/v1/restaurants', async (req, res) => {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .order('id');

  if (error) return res.status(500).json({ error });
  res.json(data);
});


// ------------------------------------------------------
// LIST SITTINGS FOR RESTAURANT
// ------------------------------------------------------
app.get('/api/v1/restaurants/:id/sittings', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('sittings')
    .select('*')
    .eq('restaurant_id', id);

  if (error) return res.status(500).json({ error });
  res.json(data);
});


// ------------------------------------------------------
// CREATE BOOKING
// ------------------------------------------------------
app.post('/api/v1/restaurants/:id/bookings', async (req, res) => {
  const { id } = req.params;

  const {
    guest_name,
    guest_email,
    guest_phone,
    covers,
    reserved_at,
    notes,
    sitting_id
  } = req.body;

  if (!guest_name || !covers || !reserved_at) {
    return res.status(400).json({ message: 'guest_name, covers, reserved_at krävs' });
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert([{
      restaurant_id: id,
      sitting_id: sitting_id || null,
      guest_name,
      guest_email,
      guest_phone,
      covers,
      reserved_at,
      status: 'booked',
      notes: notes || null
    }])
    .select();

  if (error) return res.status(500).json({ error });

  res.status(201).json({ booking: data[0] });
});


// ------------------------------------------------------
// GET BOOKINGS FOR RESTAURANT
// ------------------------------------------------------
app.get('/api/v1/restaurants/:id/bookings', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  let query = supabase
    .from('bookings')
    .select('*')
    .eq('restaurant_id', id)
    .order('reserved_at');

  if (date) {
    const start = date + "T00:00:00+01:00";
    const end = date + "T23:59:59+01:00";
    query = query.gte('reserved_at', start).lte('reserved_at', end);
  }

  const { data, error } = await query;

  if (error) return res.status(500).json({ error });
  res.json(data);
});


// ------------------------------------------------------
// CANCEL / NO-SHOW
// ------------------------------------------------------
app.patch('/api/v1/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'status krävs' });
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id);

  if (error) return res.status(500).json({ error });
  res.json({ ok: true, booking_id: id, new_status: status });
});


// ------------------------------------------------------
// SERVER
// ------------------------------------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("George Booking backend running on port", port);
});

module.exports = app;
