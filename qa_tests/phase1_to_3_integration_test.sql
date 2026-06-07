-- Phase 1 to 3 Integration & RLS Penetration Test Suite
-- Simulates buddy matching, chat setup, real-time message exchange, unmatching, and RLS bypass attempts.
-- Wraps entire test in a DO block and raises a custom exception to force rollback.

DO $$
DECLARE
  failed_tests INTEGER := 0;
  test_name TEXT;
  msg_count INTEGER;
  convo_id UUID := 'c0000000-0000-0000-0000-00000000000c';
  user_a_id UUID := '44444444-4444-4444-4444-444444444444';
  user_b_id UUID := '55555555-5555-5555-5555-555555555555';
  user_c_id UUID := '66666666-6666-6666-6666-666666666666';
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'STARTING INTEGRATION & PENETRATION TEST (PHASE 1-3)';
  RAISE NOTICE '==================================================';

  -----------------------------------------------------------------------------
  -- SETUP: Mock SignUp for User A, B, and C
  -----------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
  VALUES (user_a_id, 'usera@example.com', 'authenticated', 'authenticated', '{"date_of_birth": "1995-05-05", "username": "usera"}'::jsonb);

  INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
  VALUES (user_b_id, 'userb@example.com', 'authenticated', 'authenticated', '{"date_of_birth": "1996-06-06", "username": "userb"}'::jsonb);

  INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
  VALUES (user_c_id, 'userc@example.com', 'authenticated', 'authenticated', '{"date_of_birth": "1997-07-07", "username": "userc"}'::jsonb);

  -----------------------------------------------------------------------------
  -- BUDDY CREATION: A and B become buddies and open a conversation
  -----------------------------------------------------------------------------
  INSERT INTO public.buddies (user_id_1, user_id_2, status)
  VALUES (user_a_id, user_b_id, 'accepted');

  INSERT INTO public.conversations (id, is_group) VALUES (convo_id, false);

  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (convo_id, user_a_id);
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (convo_id, user_b_id);

  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (convo_id, user_a_id, 'Hey User B! Let''s grab beers tonight.');

  -----------------------------------------------------------------------------
  -- PENETRATION TEST 1: The Outsider (User C tries to access private chat)
  -----------------------------------------------------------------------------
  test_name := 'Penetration Test 1: Outsider (User C) RLS SELECT Block';
  BEGIN
    -- Impersonate User C
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_c_id), true);

    -- Try to read messages in Conversation between A and B
    SELECT count(*) INTO msg_count FROM public.messages WHERE conversation_id = convo_id;

    -- Reset to admin to assert
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    IF msg_count = 0 THEN
      RAISE NOTICE 'PASS: % - User C was successfully blocked from selecting private messages.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - User C successfully bypassed RLS and read % message(s).', test_name, msg_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Unexpected exception occurred: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  test_name := 'Penetration Test 1: Outsider (User C) RLS INSERT Block';
  BEGIN
    -- Impersonate User C
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_c_id), true);

    -- Try to inject a message into A and B's private chat
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (convo_id, user_c_id, 'Malicious Injection');

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - User C successfully bypassed RLS and inserted a message.', test_name;
  EXCEPTION 
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS: % - User C was successfully blocked from inserting messages.', test_name;
      PERFORM set_config('role', 'postgres', true);
      PERFORM set_config('request.jwt.claims', '', true);
    WHEN OTHERS THEN
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
      PERFORM set_config('role', 'postgres', true);
      PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- GHOSTING ACTION: User A unmatches User B
  -----------------------------------------------------------------------------
  -- Admin removes User B from buddies and from conversation_members (simulating frontend handleUnmatch)
  DELETE FROM public.buddies WHERE user_id_1 = user_a_id AND user_id_2 = user_b_id;
  DELETE FROM public.conversation_members WHERE conversation_id = convo_id AND user_id = user_b_id;

  -----------------------------------------------------------------------------
  -- PENETRATION TEST 2: The Ghosted User (User B tries to read historical chat)
  -----------------------------------------------------------------------------
  test_name := 'Penetration Test 2: Ghosted User (User B) RLS SELECT Block';
  BEGIN
    -- Impersonate User B
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_b_id), true);

    -- Try to read historical messages in Conversation
    SELECT count(*) INTO msg_count FROM public.messages WHERE conversation_id = convo_id;

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    IF msg_count = 0 THEN
      RAISE NOTICE 'PASS: % - Unmatched User B was blocked from reading historical chat messages.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - User B bypassed RLS and read % historical messages after being unmatched.', test_name, msg_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Unexpected exception occurred: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- SUITE WRAPUP
  -----------------------------------------------------------------------------
  RAISE NOTICE '==================================================';
  IF failed_tests > 0 THEN
    RAISE EXCEPTION 'PENETRATION VERIFICATION FAILED: % test(s) failed.', failed_tests;
  ELSE
    RAISE NOTICE 'PENETRATION VERIFICATION PASSED: All RLS penetration vectors secure!';
    -- Raise custom exception to force clean rollback
    RAISE EXCEPTION 'ROLLBACK_SUCCESS';
  END IF;

END;
$$;
