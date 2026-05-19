require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function testUpload() {
  const TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  const APP_ID = '2052352668968564'; // from one of the conversation summaries
  
  // 1. Get an image buffer
  // We'll create a dummy text file to act as our image, wait Meta checks mime types.
  // Let's download a small image from pixabay.
  const imgRes = await fetch("https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885_1280.jpg");
  const arrayBuffer = await imgRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  console.log("File size:", buffer.length);
  
  // 2. Create upload session
  const sessionUrl = `https://graph.facebook.com/v20.0/${APP_ID}/uploads?file_length=${buffer.length}&file_type=image/jpeg`;
  const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  const sessionData = await sessionRes.json();
  console.log("Session:", sessionData);
  
  if (!sessionData.id) return;
  
  // 3. Upload file
  const uploadUrl = `https://graph.facebook.com/v20.0/${sessionData.id}`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'file_offset': '0'
    },
    body: buffer
  });
  
  const uploadData = await uploadRes.json();
  console.log("Upload:", uploadData);
  
  if (!uploadData.h) return;
  
  // 4. Create Template
  // ... let's just log the handle.
}

testUpload();
