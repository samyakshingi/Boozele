-- Fix public.get_or_create_direct_conversation function schema mismatch
-- Queries and inserts using the correct 'is_group = false' instead of the nonexistent 'type = direct' column
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(user_a UUID, user_b UUID)
RETURNS UUID AS $$
DECLARE
  convo_id UUID;
BEGIN
  -- Check if a direct conversation between these two users already exists
  SELECT c.id INTO convo_id
  FROM public.conversations c
  JOIN public.conversation_members cm1 ON c.id = cm1.conversation_id
  JOIN public.conversation_members cm2 ON c.id = cm2.conversation_id
  WHERE c.is_group = false
    AND cm1.user_id = user_a
    AND cm2.user_id = user_b;

  -- If it doesn't exist, create it
  IF convo_id IS NULL THEN
    -- Insert conversation
    INSERT INTO public.conversations (is_group)
    VALUES (false)
    RETURNING id INTO convo_id;

    -- Insert members
    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES 
      (convo_id, user_a),
      (convo_id, user_b);
  END IF;

  RETURN convo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
