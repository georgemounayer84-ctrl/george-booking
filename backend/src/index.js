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
    const defaultSession =
