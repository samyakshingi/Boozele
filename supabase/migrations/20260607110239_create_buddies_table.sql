-- Create buddy relationship status ENUM
CREATE TYPE public.buddy_status AS ENUM ('pending', 'accepted', 'blocked');

-- Create buddies table
CREATE TABLE public.buddies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id_1 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_id_2 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status public.buddy_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Enforce deterministic ID order to prevent duplicate rows (e.g., A-B and B-A swapping places)
  CONSTRAINT check_user_order CHECK (user_id_1 < user_id_2),
  
  -- Prevent multiple relationship records between the same two users
  CONSTRAINT unique_buddy_pair UNIQUE (user_id_1, user_id_2)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.buddies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for buddies
CREATE POLICY "Allow users to view their own buddy relationships" ON public.buddies
  FOR SELECT TO authenticated USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Allow users to initiate buddy relationships" ON public.buddies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Allow users to update their own buddy status" ON public.buddies
  FOR UPDATE TO authenticated USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Allow users to delete their own buddy relationships" ON public.buddies
  FOR DELETE TO authenticated USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Reusable update trigger function (if not already existing)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on record change
CREATE TRIGGER update_buddies_updated_at
  BEFORE UPDATE ON public.buddies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
