-- Fix Security Definer Search Path Hijacking for public.is_conversation_member
CREATE OR REPLACE FUNCTION public.is_conversation_member(convo_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = convo_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix Storage Update Policy for Profile Photos
DROP POLICY IF EXISTS "Allow users to update their own avatars" ON storage.objects;
CREATE POLICY "Allow users to update their own avatars" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Add Performance Indexes to avoid table scans
CREATE INDEX IF NOT EXISTS idx_buddies_user_id_2 ON public.buddies(user_id_2);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plans_host_id ON public.plans(host_id);
CREATE INDEX IF NOT EXISTS idx_plans_conversation_id ON public.plans(conversation_id);
