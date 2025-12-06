import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://smunkjdnsybwsqwdvgsp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtdW5ramRuc3lid3Nxd2R2Z3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MzU0MDUsImV4cCI6MjA4MDIxMTQwNX0.Ljxbjhwu-OX8rYuNpXDQOF6yy77-5raqZB9j88wOX3Y'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)