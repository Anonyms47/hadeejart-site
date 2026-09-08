/* ======================================================================
   Hadeej'Art — Configuration Supabase (site public)
   La clé "anon" est publique par conception (protégée par les policies RLS
   côté serveur) : elle peut être commise sans risque. Ne JAMAIS mettre la
   clé "service_role" ici ni dans aucun fichier livré au navigateur.
   ====================================================================== */
const SUPABASE_URL = 'https://spfcwivuijjmbdoooaci.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZmN3aXZ1aWpqbWJkb29vYWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTMxNTgsImV4cCI6MjEwNDI4OTE1OH0.xtduSR5xHWKwV5x3zN3Yf36IuxJMf9gjFTocWW0AccI';

/* Numéro WhatsApp (sans +) — utilisé par le panier, le footer et le menu
   mobile sur toutes les pages du site. */
const SITE_WA_NUMBER = '781444340';
