
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
console.log('Has DB URL:', !!process.env.DATABASE_URL);

