-- 1. Add is_vip column to profiles table
ALTER TABLE public.profiles ADD COLUMN is_vip BOOLEAN DEFAULT false NOT NULL;

-- 2. Create trigger function to block authenticated users from self-upgrading
CREATE OR REPLACE FUNCTION public.prevent_vip_self_upgrade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_vip IS DISTINCT FROM OLD.is_vip AND auth.role() = 'authenticated' THEN
    NEW.is_vip := OLD.is_vip;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind trigger to profiles table
DROP TRIGGER IF EXISTS tr_prevent_vip_self_upgrade ON public.profiles;
CREATE TRIGGER tr_prevent_vip_self_upgrade
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_vip_self_upgrade();

-- 4. Create testing RPC to simulate webhook upgrade in dev
CREATE OR REPLACE FUNCTION public.test_vip_upgrade(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET is_vip = true
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
