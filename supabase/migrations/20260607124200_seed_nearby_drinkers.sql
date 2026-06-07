-- Seed mock users into auth.users (trigger handle_new_user automatically creates profiles)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES 
  ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'clara@boozele.com', crypt('password123', gen_salt('bf')), now(), '{"username": "Clara", "date_of_birth": "1998-04-12"}', now(), now(), 'authenticated', 'authenticated'),
  ('b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e', 'james@boozele.com', crypt('password123', gen_salt('bf')), now(), '{"username": "James", "date_of_birth": "1995-09-21"}', now(), now(), 'authenticated', 'authenticated'),
  ('c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 'ananya@boozele.com', crypt('password123', gen_salt('bf')), now(), '{"username": "Ananya", "date_of_birth": "2000-11-05"}', now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Update the profiles with drink preferences, intents, and location coordinates
-- San Francisco coordinates: lon -122.4194, lat 37.7749
UPDATE public.profiles
SET 
  drink_preferences = ARRAY['Cocktails', 'Wine'],
  intents = ARRAY['1-on-1'],
  avatar_urls = ARRAY['https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80'],
  location = ST_MakePoint(-122.418, 37.775)::geography
WHERE id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

UPDATE public.profiles
SET 
  drink_preferences = ARRAY['Craft Beer', 'Whiskey'],
  intents = ARRAY['1-on-1', 'group'],
  avatar_urls = ARRAY['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80'],
  location = ST_MakePoint(-122.420, 37.780)::geography
WHERE id = 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e';

UPDATE public.profiles
SET 
  drink_preferences = ARRAY['Wine', 'Sober-Curious'],
  intents = ARRAY['group'],
  avatar_urls = ARRAY['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80'],
  location = ST_MakePoint(-122.410, 37.770)::geography
WHERE id = 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f';
