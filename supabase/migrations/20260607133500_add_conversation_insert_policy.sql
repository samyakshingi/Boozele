-- Enable INSERT policy on conversations for authenticated users
DROP POLICY IF EXISTS "Allow authenticated to insert conversations" ON public.conversations;
CREATE POLICY "Allow authenticated to insert conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (true);
