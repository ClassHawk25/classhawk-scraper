import { Expo } from 'expo-server-sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const expo = new Expo();

export async function checkAndNotify(scrapedClasses) {
  console.log('🔔 [Notifier] Checking for waitlist matches...');

  // 1. Filter for OPEN classes only
  const openClasses = scrapedClasses.filter(c => 
    c.status && c.status.toUpperCase() === 'OPEN'
  );

  if (openClasses.length === 0) {
    console.log('   No open classes in this batch. Skipping.');
    return;
  }

  const openIds = openClasses.map(c => c.class_uid);

  try {
    // 2. Find Bookmarks for these classes
    // We look for bookmarks where class_uid matches one of our OPEN classes
    const { data: bookmarks, error } = await supabase
      .from('class_bookmarks')
      .select(`
        id,
        user_id,
        class_uid
      `)
      .in('class_uid', openIds);

    if (error) throw error;

    if (!bookmarks || bookmarks.length === 0) {
      console.log('   No active bookmarks found for these classes.');
      return;
    }

    console.log(`   🎯 Found ${bookmarks.length} alerts to fire!`);

    // 3. Get Device Tokens for these users
    const userIds = [...new Set(bookmarks.map(b => b.user_id))];
    const { data: devices } = await supabase
      .from('user_devices')
      .select('user_id, device_token')
      .in('user_id', userIds);

    if (!devices) return;

    // 4. Construct Messages
    let messages = [];
    let bookmarkIdsToDelete = [];

    bookmarks.forEach(bookmark => {
      const classDetails = openClasses.find(c => c.class_uid === bookmark.class_uid);
      const userDevice = devices.find(d => d.user_id === bookmark.user_id);

      if (classDetails && userDevice && Expo.isExpoPushToken(userDevice.device_token)) {
        messages.push({
          to: userDevice.device_token,
          sound: 'default',
          title: 'Spot Found! 🎟️',
          body: `${classDetails.class_name} w/ ${classDetails.trainer} is now OPEN! Tap to book.`,
          data: { url: classDetails.link }, // We can use this to deep link later
        });
        
        // Add to deletion list (Waitlist Sniper rule: One shot, one kill)
        bookmarkIdsToDelete.push(bookmark.id);
      }
    });

    // 5. Send Notifications
    if (messages.length > 0) {
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await expo.sendPushNotificationsAsync(chunk);
      }
      console.log(`   🚀 Sent ${messages.length} push notifications.`);

      // 6. Cleanup: Delete the bookmarks so we don't spam them next time
      if (bookmarkIdsToDelete.length > 0) {
        await supabase
          .from('class_bookmarks')
          .delete()
          .in('id', bookmarkIdsToDelete);
        console.log('   🧹 Cleared fired bookmarks.');
      }
    }

  } catch (error) {
    console.error('   ❌ Notifier Error:', error.message);
  }
}