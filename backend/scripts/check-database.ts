import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '../.env') }); // Look for .env in root directory

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Checking Supabase Schema...');
  
  // Check view_once_captures media_type constraint
  console.log('\n--- Table: view_once_captures ---');
  const { data: captures, error: capturesError } = await supabase
    .from('view_once_captures')
    .select('*')
    .limit(1);
    
  if (capturesError) {
    console.error('❌ Error selecting from view_once_captures:', capturesError.message);
  } else {
    console.log('✅ view_once_captures table exists');
  }

  // Check view_once_command_config table
  console.log('\n--- Table: view_once_command_config ---');
  const { data: config, error: configError } = await supabase
    .from('view_once_command_config')
    .select('*')
    .limit(1);
    
  if (configError) {
    console.error('❌ Error selecting from view_once_command_config:', configError.message);
  } else {
    console.log('✅ view_once_command_config table exists');
    console.log('Columns:', Object.keys(config[0] || {}));
  }

  // Test an insertion of 'audio' into view_once_captures to see if constraint fails
  console.log('\n--- Testing "audio" constraint ---');
  const { error: testError } = await supabase
    .from('view_once_captures')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      sender_id: 'test',
      sender_name: 'test',
      media_url: 'http://test.com',
      media_type: 'audio'
    });
    
  if (testError && testError.message.includes('check constraint')) {
    console.error('❌ CHECK constraint fails for "audio". SQL update needed.');
  } else if (testError && testError.message.includes('foreign key')) {
    console.log('✅ (Expected) Foreign key failed, but constraint might be OK or not reached.');
  } else if (testError) {
    console.error('ℹ️ Other error:', testError.message);
  } else {
    console.log('✅ Insertion of "audio" succeeded (Wait, it should fail if user not found, but it means type is allowed)');
  }
}

checkSchema();
