const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Simple public endpoint: list restaurants
app.get('/api/v1/restaurants', async (req,res) => {
  const r = await db.query('SELECT id,name,timezone,currency,slot_interval_minutes,default_session_length,default_clearing_buffer,max_capacity FROM restaurants ORDER BY id');
  res.json(r.rows);
});

// Get sittings
app.get('/api/v1/restaurants/:id/sittings', async (req,res) => {
  const { id } = req.params;
  const r = await db.query('SELECT * FROM sittings WHERE restaurant_id=$1 AND enabled=true', [id]);
  res.json(r.rows);
});

// Availability logic
app.get('/api/v1/restaurants/:id/availability', async (req,res) => {
  try {
    const { id } = req.params;
    const { date, party_size } = req.query;
    if(!date) return res.status(400).json({message:'date=YYYY-MM-DD krävs'});

    const restaurantR = await db.query('SELECT * FROM restaurants WHERE id=$1', [id]);
    if(restaurantR.rowCount===0) return res.status(404).json({message:'restaurant not found'});
    const R = restaurantR.rows[0];
    const slotInterval = R.slot_interval_minutes || 15;
    const defaultSession = R.default_session_length || 150;

    const sittingsRes = await db.query('SELECT * FROM sittings WHERE restaurant_id=$1 AND enabled=true', [id]);
    const sittings = sittingsRes.rows;

    const slots = [];

    for(const S of sittings){
      const startParts = S.start_time.toString(); 
      const startHour = parseInt(startParts.split(':')[0],10);
      const startMin = parseInt(startParts.split(':')[1],10);

      const sessionStart = new Date(date + 'T00:00:00');
      sessionStart.setHours(startHour, startMin,0,0);

      const maxDuration = S.max_duration_minutes || defaultSession;
      const sessionEnd = new Date(sessionStart.getTime() + maxDuration*60000);

      const lastStart = new Date(sessionEnd.getTime() - (defaultSession*60000));

      for(let t = new Date(sessionStart); t <= lastStart; t = new Date(t.getTime() + slotInterval*60000)) {
        const slotStart = new Date(t);
        const slotEnd = new Date(slotStart.getTime() + defaultSession*60000);

        const bookingsRes = await db.query(
          `SELECT COALESCE(SUM(party_size),0) as used FROM bookings
           WHERE restaurant_id=$1 AND status='confirmed'
           AND NOT (requested_end <= $2 OR requested_start >= $3)`,
          [id, slotStart.toISOString(), slotEnd.toISOString()]
        );

        const used = parseInt(bookingsRes.rows[0].used,10);
        const freeSeats = Math.max(0, R.max_capacity - used);
        const available = freeSeats >= (parseInt(party_size||1,10));

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          available,
          free_seats: freeSeats
        });
      }
    }

    res.json({date, restaurant_id: parseInt(id,10), party_size: parseInt(party_size||1,10), slots});
  } catch(err){
    console.error(err);
    res.status(500).json({message:'server error'});
  }
});

// Create booking
app.post('/api/v1/restaurants/:id/bookings', async (req,res) => {
  const { id } = req.params;
  const { guest_name, guest_email, guest_phone, party_size, requested_start, requested_end, source } = req.body;

  if(!guest_name || !party_size || !requested_start || !requested_end)
    return res.status(400).json({message:'fält saknas'});

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // basic lock to reduce race
    const lockKey = Math.floor(new Date(requested_start).getTime() / 60000);
    await client.query('SELECT pg_advisory_xact_lock($1,$2)', [parseInt(id,10), lockKey]);

    const restaurantR = await client.query('SELECT max_capacity FROM restaurants WHERE id=$1 FOR SHARE', [id]);
    if(restaurantR.rowCount===0) {
      await client.query('ROLLBACK');
      return res.status(404).json({message:'restaurant not found'});
    }

    const maxCap = restaurantR.rows[0].max_capacity;

    const overlapRes = await client.query(
      `SELECT COALESCE(SUM(party_size),0) as used FROM bookings
       WHERE restaurant_id=$1 AND status='confirmed'
       AND NOT (requested_end <= $2 OR requested_start >= $3)`,
      [id, requested_start, requested_end]
    );

    const used = parseInt(overlapRes.rows[0].used,10);

    if(used + parseInt(party_size,10) > maxCap){
      await client.query('ROLLBACK');
      return res.status(409).json({message:'Inga lediga platser för valt tidsfönster'});
    }

    const insertRes = await client.query(
      `INSERT INTO bookings (restaurant_id, guest_name, guest_email, guest_phone, party_size, requested_start, requested_end, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
       [id, guest_name, guest_email, guest_phone, party_size, requested_start, requested_end, source || 'widget']
    );

    const bookingId = insertRes.rows[0].id;

    await client.query(
      `INSERT INTO booking_audit (booking_id, action, actor, payload) VALUES ($1,'create','guest',$2)`,
      [bookingId, JSON.stringify(req.body)]
    );

    await client.query('COMMIT');

    res.status(201).json({booking_id: bookingId, status:'confirmed'});
  } catch(err){
    await client.query('ROLLBACK').catch(()=>{});
    console.error('booking error', err);
    res.status(500).json({message:'server error'});
  } finally {
    client.release();
  }
});

// List bookings for a restaurant
app.get('/api/v1/restaurants/:id/bookings', async (req,res) => {
  const { id } = req.params;
  const { date } = req.query;

  let q = 'SELECT * FROM bookings WHERE restaurant_id=$1';
  const params = [id];

  if(date){
    const dayStart = new Date(date+'T00:00:00').toISOString();
    const dayEnd = new Date(new Date(date+'T00:00:00').getTime() + 24*3600*1000).toISOString();
    q += ' AND requested_start >= $2 AND requested_start < $3';
    params.push(dayStart, dayEnd);
  }

  q += ' ORDER BY requested_start';

  const r = await db.query(q, params);
  res.json(r.rows);
});

// Cancel / no-show
app.patch('/api/v1/bookings/:id', async (req,res) => {
  const { id } = req.params;
  const { status } = req.body;

  if(!status) return res.status(400).json({message:'status krävs'});

  await db.query('UPDATE bookings SET status=$1, updated_at=now() WHERE id=$2', [status, id]);

  await db.query(
    `INSERT INTO booking_audit (booking_id, action, actor, payload) VALUES ($1,$2,$3,$4)`,
    [id, 'status_change', 'staff', JSON.stringify({status})]
  );

  res.json({ok:true});
});

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log('Server running on port', port));
