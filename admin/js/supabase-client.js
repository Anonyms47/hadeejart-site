/* ======================================================================
   Hadeej'Art Admin — Client Supabase (auth + CRUD via supabase-js)
   Clé "anon" publique par conception ; toute la sécurité réelle est
   assurée par les policies RLS (voir migrations) et par la vérification
   du rôle admin après connexion.
   ====================================================================== */
const SUPABASE_URL = 'https://nwujdxrelsjicvsnbgzc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53dWpkeHJlbHNqaWN2c25iZ3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTQ3NzMsImV4cCI6MjEwNTkzMDc3M30.ObirBQiDXH3kOIcZBF-Se-fuGOoccb1ozWSSKxfAA24';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
