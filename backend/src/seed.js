// backend/src/seed.js
// ------------------------------------------------------
// Seed-data för Supabase-databasen
// Körs via Node (GitHub Actions eller manuellt i workflow)
// ------------------------------------------------------

const { supabase } = require('./db');

async function seed() {
  try {
    console.log("Startar seed...");

    // -----------------------------------------
    // 1. Skapa demo-restaurang
    // -----------------------------------------
    const restaurantPayload = {
      id: "11111111-1111-1111-1111-111111111111", // fast ID för konsekvens
      name: "Demo Bistro",
      org_number: "123456-7890",
      timezone: "Europe/Stockholm"
    };

    const { data: restaurantData, error: restaurantErr } = await supabase
      .from("restaurants")
      .insert([restaurantPayload])
      .select();

    if (restaurantErr) {
      console.error("Fel vid skapande av restaurang:", restaurantErr);
      // fortsätt även om den redan finns
    } else {
      console.log("Restaurang skapad:", restaurantData[0]);
    }

    // -----------------------------------------
    // 2. Skapa en demo-sitting (18–20)
    // -----------------------------------------
    const start = new Date();
    start.setHours(18, 0, 0, 0);
    const end = new Date();
    end.setHours(20, 0, 0, 0);

    const sittingPayload = {
      restaurant_id: restaurantPayload.id,
      name: "Demo Sitting 18–20",
      start_ts: start.toISOString(),
      end_ts: end.toISOString()
    };

    const { data: sitData, error: sitErr } = await supabase
      .from("sittings")
      .insert([sittingPayload])
      .select();

    if (sitErr) {
      console.error("Fel vid skapande av sitting:", sitErr);
    } else {
      console.log("Sitting skapad:", sitData[0]);
    }

    // -----------------------------------------
    // KLART
    // -----------------------------------------
    console.log("Seed klar.");
    process.exit(0);

  } catch (e) {
    console.error("SEED ERROR:", e);
    process.exit(1);
  }
}

seed();
