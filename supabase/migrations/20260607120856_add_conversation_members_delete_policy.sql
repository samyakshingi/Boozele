-- Enable DELETE policy on conversation_members for authenticated users removing themselves
DROP POLICY IF EXISTS "Allow members to leave conversation" ON public.conversation_members;
CREATE POLICY "Allow members to leave conversation" ON public.conversation_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
