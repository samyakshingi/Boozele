-- Enable DELETE policy on conversations for members of that conversation
DROP POLICY IF EXISTS "Allow members to delete conversations" ON public.conversations;
CREATE POLICY "Allow members to delete conversations" ON public.conversations
  FOR DELETE TO authenticated USING (public.is_conversation_member(id, auth.uid()));
