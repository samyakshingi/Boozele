-- Create security definer helper to check if a conversation has members (bypassing RLS filters)
CREATE OR REPLACE FUNCTION public.has_conversation_members(convo_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = convo_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create security definer helper to check if user is buddy matched with any existing conversation member (bypassing RLS filters)
CREATE OR REPLACE FUNCTION public.is_buddy_of_member(convo_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_members cm
    JOIN public.buddies b ON (cm.user_id = b.user_id_1 OR cm.user_id = b.user_id_2)
    WHERE cm.conversation_id = convo_id
      AND b.status = 'accepted'
      AND (b.user_id_1 = check_user_id OR b.user_id_2 = check_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-apply conversation_members insert policy using these secure checks
DROP POLICY IF EXISTS "Allow users to join conversation members" ON public.conversation_members;
CREATE POLICY "Allow users to join conversation members" ON public.conversation_members
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND (
      -- 1. Anyone can RSVP to public group parties
      EXISTS (
        SELECT 1 FROM public.plans p
        WHERE p.conversation_id = conversation_members.conversation_id
          AND p.is_public = true
      )
      -- 2. Creator (host) can add themselves on creation (safely checked via SECURITY DEFINER)
      OR NOT public.has_conversation_members(conversation_members.conversation_id)
      -- 3. Buddies can join direct match threads (safely checked via SECURITY DEFINER)
      OR public.is_buddy_of_member(conversation_members.conversation_id, auth.uid())
    )
  );
