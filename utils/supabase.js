import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; 

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Key in .env file!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveToSupabase(classes) {
    if (classes.length === 0) return;

    console.log(`[Supabase] Uploading ${classes.length} classes...`);

    const formattedData = classes.map(c => {
        const uniqueId = `${c.gym}-${c.raw_date}-${c.start_time}-${c.location}`
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-');

        return {
            class_uid: uniqueId, 
            gym_slug: c.gym,
            class_name: c.class_name,
            trainer: c.instructor,
            location: c.location,
            date: c.raw_date,
            time: c.start_time,
            status: c.status,
            link: c.link, // <--- NOW ACTIVE
            created_at: new Date()
        };
    });

    const { data, error } = await supabase
        .from('classes') 
        .upsert(formattedData, { onConflict: 'class_uid' });

    if (error) {
        console.error('[Supabase] Error uploading:', error.message);
    } else {
        console.log('[Supabase] Success! Data synced.');
    }
}