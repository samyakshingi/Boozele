-- Helper security definer function to avoid RLS policy recursion on junction table checks
CREATE OR REPLACE FUNCTION public.is_conversation_member(convo_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_members 
    WHERE conversation_id = convo_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------
-- PROFILES POLICIES
-- -------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
CREATE POLICY "Allow public read access to profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- -------------------------------------------------------------
-- BUDDIES POLICIES
-- -------------------------------------------------------------
ALTER TABLE public.buddies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to view their own buddy relationships" ON public.buddies;
CREATE POLICY "Allow users to view their own buddy relationships" ON public.buddies
  FOR SELECT TO authenticated USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

DROP POLICY IF EXISTS "Allow users to initiate buddy relationships" ON public.buddies;
CREATE POLICY "Allow users to initiate buddy relationships" ON public.buddies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

DROP POLICY IF EXISTS "Allow users to update their own buddy status" ON public.buddies;
CREATE POLICY "Allow users to update their own buddy status" ON public.buddies
  FOR UPDATE TO authenticated USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

DROP POLICY IF EXISTS "Allow users to delete their own buddy relationships" ON public.buddies;
CREATE POLICY "Allow users to delete their own buddy relationships" ON public.buddies
  FOR DELETE TO authenticated USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- -------------------------------------------------------------
-- CONVERSATIONS POLICIES
-- -------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow members to read conversations" ON public.conversations;
CREATE POLICY "Allow members to read conversations" ON public.conversations
  FOR SELECT TO authenticated USING (public.is_conversation_member(id, auth.uid()));

-- -------------------------------------------------------------
-- CONVERSATION MEMBERS POLICIES
-- -------------------------------------------------------------
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow members to read conversation members" ON public.conversation_members;
CREATE POLICY "Allow members to read conversation members" ON public.conversation_members
  FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Allow users to join conversation members" ON public.conversation_members;
CREATE POLICY "Allow users to join conversation members" ON public.conversation_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------------
-- MESSAGES POLICIES
-- -------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow members to read messages" ON public.messages;
CREATE POLICY "Allow members to read messages" ON public.messages
  FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Allow members to send messages" ON public.messages;
CREATE POLICY "Allow members to send messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    public.is_conversation_member(conversation_id, auth.uid()) 
    AND auth.uid() = sender_id
  );

-- -------------------------------------------------------------
-- PLANS POLICIES
-- -------------------------------------------------------------
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select access to plans" ON public.plans;
CREATE POLICY "Allow select access to plans" ON public.plans
  FOR SELECT TO authenticated USING (
    is_public = true 
    OR public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Allow insert access to plans" ON public.plans;
CREATE POLICY "Allow insert access to plans" ON public.plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Allow update access to plans" ON public.plans;
CREATE POLICY "Allow update access to plans" ON public.plans
  FOR UPDATE TO authenticated USING (
    auth.uid() = host_id 
    OR public.is_conversation_member(conversation_id, auth.uid())
  ) WITH CHECK (
    auth.uid() = host_id 
    OR public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Allow delete access to plans" ON public.plans;
CREATE POLICY "Allow delete access to plans" ON public.plans
  FOR DELETE TO authenticated USING (auth.uid() = host_id);
