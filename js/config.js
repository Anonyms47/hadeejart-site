/* ======================================================================
   Hadeej'Art — Configuration Supabase (site public)
   La clé "anon" est publique par conception (protégée par les policies RLS
   côté serveur) : elle peut être commise sans risque. Ne JAMAIS mettre la
   clé "service_role" ici ni dans aucun fichier livré au navigateur.
   ====================================================================== */
const SUPABASE_URL = 'https://nwujdxrelsjicvsnbgzc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53dWpkeHJlbHNqaWN2c25iZ3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTQ3NzMsImV4cCI6MjEwNTkzMDc3M30.ObirBQiDXH3kOIcZBF-Se-fuGOoccb1ozWSSKxfAA24';

/* Numéro WhatsApp au format international, sans + ni espaces (indicatif du
   Sénégal 221 inclus : sans indicatif, wa.me ne trouve pas le numéro) — — utilisé par le panier, le footer et le menu
   mobile sur toutes les pages du site. */
const SITE_WA_NUMBER = '221781444340';
