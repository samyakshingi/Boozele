-- Create swipes table
CREATE TABLE public.swipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  swiper_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  swiped_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  is_right_swipe BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Unique constraint to prevent double swiping
  CONSTRAINT unique_swipe UNIQUE (swiper_id, swiped_id)
);

-- Enable RLS on swipes
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;

-- Swipes RLS Policies
CREATE POLICY "Allow users to view their own swipes" ON public.swipes
  FOR SELECT TO authenticated USING (auth.uid() = swiper_id);

CREATE POLICY "Allow users to create their own swipes" ON public.swipes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = swiper_id);

-- Update get_nearby_drinkers to filter out already swiped users
CREATE OR REPLACE FUNCTION public.get_nearby_drinkers(lat float, lon float, radius_km float)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_urls TEXT[],
  drink_preferences TEXT[],
  intents TEXT[],
  date_of_birth DATE,
  location geography(POINT, 4326),
  distance_meters float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.avatar_urls,
    p.drink_preferences,
    p.intents,
    p.date_of_birth,
    p.location,
    ST_Distance(p.location, ST_MakePoint(lon, lat)::geography) AS distance_meters
  FROM public.profiles p
  WHERE p.id != auth.uid()
    AND p.location IS NOT NULL
    -- Exclude users the current caller has already swiped
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes s
      WHERE s.swiper_id = auth.uid()
        AND s.swiped_id = p.id
    )
    AND ST_DWithin(p.location, ST_MakePoint(lon, lat)::geography, radius_km * 1000)
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create process_swipe function to handle swiping and auto-promotion to buddies
CREATE OR REPLACE FUNCTION public.process_swipe(target_id uuid, is_right boolean)
RETURNS json AS $$
DECLARE
  current_user_id uuid;
  is_mutual boolean := false;
  convo_id uuid := null;
  first_id uuid;
  second_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Insert swipe record
  INSERT INTO public.swipes (swiper_id, swiped_id, is_right_swipe)
  VALUES (current_user_id, target_id, is_right)
  ON CONFLICT (swiper_id, swiped_id) DO UPDATE 
  SET is_right_swipe = EXCLUDED.is_right_swipe, created_at = now();

  -- 2. Check for mutual swipe if this is a right swipe
  IF is_right THEN
    SELECT EXISTS (
      SELECT 1 FROM public.swipes 
      WHERE swiper_id = target_id 
        AND swiped_id = current_user_id 
        AND is_right_swipe = true
    ) INTO is_mutual;

    -- 3. If mutual match, promote to buddies and setup direct conversation
    IF is_mutual THEN
      -- Sort IDs to satisfy buddies constraint (user_id_1 < user_id_2)
      IF current_user_id < target_id THEN
        first_id := current_user_id;
        second_id := target_id;
      ELSE
        first_id := target_id;
        second_id := current_user_id;
      END IF;

      -- Upsert buddies record as accepted
      INSERT INTO public.buddies (user_id_1, user_id_2, status)
      VALUES (first_id, second_id, 'accepted')
      ON CONFLICT (user_id_1, user_id_2) DO UPDATE
      SET status = 'accepted', updated_at = now();

      -- Get or create direct conversation
      convo_id := public.get_or_create_direct_conversation(current_user_id, target_id);
    END IF;
  END IF;

  RETURN json_build_object(
    'is_match', is_mutual,
    'conversation_id', convo_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
