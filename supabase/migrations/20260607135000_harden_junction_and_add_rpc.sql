-- Drop the existing insert policy on conversation_members
DROP POLICY IF EXISTS "Allow users to join conversation members" ON public.conversation_members;

-- Re-create a secure insert policy checking for public plans, empty conversations, or accepted buddy status
CREATE POLICY "Allow users to join conversation members" ON public.conversation_members
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND (
      -- 1. Anyone can RSVP to public group parties
      EXISTS (
        SELECT 1 FROM public.plans p
        WHERE p.conversation_id = conversation_members.conversation_id
          AND p.is_public = true
      )
      -- 2. Creator (host) can add themselves on creation
      OR NOT EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = conversation_members.conversation_id
      )
      -- 3. Buddies can join direct match threads
      OR EXISTS (
        SELECT 1 FROM public.buddies b
        JOIN public.conversation_members cm ON (cm.user_id = b.user_id_1 OR cm.user_id = b.user_id_2)
        WHERE cm.conversation_id = conversation_members.conversation_id
          AND b.status = 'accepted'
          AND (b.user_id_1 = auth.uid() OR b.user_id_2 = auth.uid())
      )
    )
  );

-- Create atomic database RPC function to host a public party
CREATE OR REPLACE FUNCTION public.create_public_party(
  party_title TEXT,
  party_event_time TIMESTAMP WITH TIME ZONE,
  party_venue TEXT
)
RETURNS UUID AS $$
DECLARE
  new_convo_id UUID;
  active_user_id UUID;
BEGIN
  -- Get active user ID from auth session
  active_user_id := auth.uid();
  IF active_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Create group conversation
  INSERT INTO public.conversations (is_group)
  VALUES (true)
  RETURNING id INTO new_convo_id;

  -- 2. Insert member record (Host)
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (new_convo_id, active_user_id);

  -- 3. Create public plan record linked to this conversation
  INSERT INTO public.plans (host_id, conversation_id, title, event_time, venue, menu, is_public)
  VALUES (active_user_id, new_convo_id, party_title, party_event_time, party_venue, '', true);

  RETURN new_convo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
