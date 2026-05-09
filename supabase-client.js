'use strict';

const { createClient } = require('@supabase/supabase-js');
const { readConfig }   = require('./config');

let _client = null;

function getSupabase() {
  if (_client) return _client;
  const { supabaseUrl, supabaseKey } = readConfig();
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not configured — open Settings → Database to add credentials');
  }
  _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}

function resetSupabase() {
  _client = null;
}

module.exports = { getSupabase, resetSupabase };
