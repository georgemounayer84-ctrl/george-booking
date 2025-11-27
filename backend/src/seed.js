const db = require('./db');

async function seed(){
  try {
    // Skapa demo-organisation
    const org = await db.query(
      "INSERT INTO organizations (name,orgnr) VALUES ('Demo Org','556677-8899') RETURNING id"
    );
    const orgId = org.rows[0].id;

    // Skapa demo-grupp kopplad till organisationen
    const g = await db.query(
      "INSERT INTO groups (organization_id,name) VALUES ($1,$2) RETURNING id",
      [orgId,'Demo Group']
    );
    const groupId = g.rows[0].id;

    // Skapa demo-restaurang kopplad till gruppen
    await db.query(
      "INSERT INTO restaurants (group_id,name,timezone,max_capacity,slot_interval_minutes) VALUES ($1,$2,$3,$4,$5)",
      [groupId,'Restaurang Demo','Europe/Stockholm',40,15]
    );

    // Hämta restaurang-ID
    const r = await db.query(
      "SELECT id FROM restaurants WHERE name='Restaurang Demo' LIMIT 1"
    );
    const rid = r.rows[0].id;

    // Skapa två sittningar (17:00 och 20:00) för måndag–fredag (0-4)
    for(let d = 0; d < 5; d++){
      await db.query(
        "INSERT INTO sittings (restaurant_id,day_of_week,start_time,max_duration_minutes,clearing_buffer_minutes) VALUES ($1,$2,$3,$4,$5)",
        [rid,d,'17:00',150,30]
      );

      await db.query(
        "INSERT INTO sittings (restaurant_id,day_of_week,start_time,max_duration_minutes,clearing_buffer_minutes) VALUES ($1,$2,$3,$4,$5)",
        [rid,d,'20:00',150,30]
      );
    }

    console.log('Seed klar');
    process.exit(0);

  } catch(e){
    console.error('seed error', e);
    process.exit(1);
  }
}

seed();
