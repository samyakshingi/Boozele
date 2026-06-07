-- Create custom age verification function (marked IMMUTABLE for CHECK constraint compatibility)
CREATE OR REPLACE FUNCTION public.is_at_least_21(dob DATE)
RETURNS BOOLEAN AS $$
BEGIN
  IF dob IS NULL THEN
    RETURN FALSE;
  END IF;
  -- True if DOB is 21 or more years in the past from the current execution date
  RETURN dob <= (CURRENT_DATE - INTERVAL '21 years');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  date_of_birth DATE NOT NULL,
  drink_preferences TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Strict check constraint using our age verification function
  CONSTRAINT check_age_21 CHECK (public.is_at_least_21(date_of_birth))
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Allow public read access to profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Create profile trigger function for new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  dob_text TEXT;
  dob_val DATE;
  username_val TEXT;
BEGIN
  -- Extract and validate date of birth from raw_user_meta_data
  dob_text := new.raw_user_meta_data->>'date_of_birth';
  IF dob_text IS NULL THEN
    RAISE EXCEPTION 'date_of_birth is required in user metadata';
  END IF;
  
  dob_val := dob_text::DATE;
  
  -- Extract username or fall back to email / automatic id
  username_val := COALESCE(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'email',
    'user_' || substr(new.id::text, 1, 8)
  );

  INSERT INTO public.profiles (id, username, date_of_birth)
  VALUES (new.id, username_val, dob_val);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute handle_new_user after signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
