/* ======================================================================
   Hadeej'Art Admin — Client Supabase (auth + CRUD via supabase-js)
   Clé "anon" publique par conception ; toute la sécurité réelle est
   assurée par les policies RLS (voir migrations) et par la vérification
   du rôle admin après connexion.
   ====================================================================== */
const SUPABASE_URL = 'https://spfcwivuijjmbdoooaci.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZmN3aXZ1aWpqbWJkb29vYWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTMxNTgsImV4cCI6MjEwNDI4OTE1OH0.xtduSR5xHWKwV5x3zN3Yf36IuxJMf9gjFTocWW0AccI';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
