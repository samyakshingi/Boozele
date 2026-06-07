-- Phase 1 RLS and Schema Verification Suite
-- Wraps entire test in a DO block and raises an exception at the end to force rollback.

DO $$
DECLARE
  failed_tests INTEGER := 0;
  test_name TEXT;
  msg_count INTEGER;
  plan_count INTEGER;
  convo_a_id UUID := 'a0000000-0000-0000-0000-00000000000a';
  convo_b_id UUID := 'b0000000-0000-0000-0000-00000000000b';
  msg_a_id UUID := 'a0000000-0000-0000-0000-000000000001';
  msg_b_id UUID := 'b0000000-0000-0000-0000-000000000001';
  plan_b_id UUID := 'b0000000-0000-0000-0000-000000000002';
  user_underage_id UUID := '22222222-2222-2222-2222-222222222222';
  user_a_id UUID := '44444444-4444-4444-4444-444444444444';
  user_b_id UUID := '55555555-5555-5555-5555-555555555555';
  user_c_id UUID := '66666666-6666-6666-6666-666666666666';
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'STARTING DATABASE VERIFICATION AND PENETRATION TEST';
  RAISE NOTICE '==================================================';

  -----------------------------------------------------------------------------
  -- TEST 1: Age Constraint Test (reject profiles < 21)
  -----------------------------------------------------------------------------
  test_name := 'Test 1: Age Constraint Check (Underage profile reject)';
  BEGIN
    -- Attempt to insert a user in auth.users with underage DOB in metadata.
    -- This should trigger handle_new_user() which inserts into profiles, violating check_age_21.
    INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
    VALUES (
      user_underage_id, 
      'underage@example.com', 
      'authenticated', 
      'authenticated',
      '{"date_of_birth": "2007-06-08", "username": "underage"}'::jsonb
    );

    -- If insertion succeeded, that is a failure of the check constraint
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Underage user was successfully registered and profile created.', test_name;
  EXCEPTION 
    WHEN check_violation THEN
      RAISE NOTICE 'PASS: % - Underage profile was successfully rejected by check constraint (check_age_21) via the trigger.', test_name;
    WHEN OTHERS THEN
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Unexpected error occurred: %', test_name, SQLERRM;
  END;

  -----------------------------------------------------------------------------
  -- TEST 2: Trigger Test (auth.users to profiles auto-creation)
  -----------------------------------------------------------------------------
  test_name := 'Test 2: Trigger Test (auth.users -> profiles automatic sync)';
  BEGIN
    -- Insert user with proper metadata including DOB (21+) and username
    INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
    VALUES (
      user_a_id, 
      'usera@example.com', 
      'authenticated', 
      'authenticated', 
      '{"date_of_birth": "1995-05-05", "username": "usera"}'::jsonb
    );

    -- Check if profile was automatically provisioned
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = user_a_id AND username = 'usera' AND date_of_birth = '1995-05-05'
    ) THEN
      RAISE NOTICE 'PASS: % - Profile was successfully auto-created by handle_new_user trigger.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Profile was not created or contains mismatched data.', test_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
  END;

  -- Create remaining test users User B and User C using the trigger
  INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
  VALUES (
    user_b_id, 
    'userb@example.com', 
    'authenticated', 
    'authenticated', 
    '{"date_of_birth": "1996-06-06", "username": "userb"}'::jsonb
  );

  INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
  VALUES (
    user_c_id, 
    'userc@example.com', 
    'authenticated', 
    'authenticated', 
    '{"date_of_birth": "1997-07-07", "username": "userc"}'::jsonb
  );

  -----------------------------------------------------------------------------
  -- TEST 3: Buddy sorting constraint (user_id_1 < user_id_2)
  -----------------------------------------------------------------------------
  test_name := 'Test 3: Buddy Sorting Constraint (user_id_1 < user_id_2)';
  BEGIN
    -- user_b_id ('55555555...') is greater than user_a_id ('44444444...').
    -- Attempting to insert (user_b_id, user_a_id) should fail.
    INSERT INTO public.buddies (user_id_1, user_id_2, status)
    VALUES (user_b_id, user_a_id, 'pending');

    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Allowed buddy pair insert where user_id_1 > user_id_2.', test_name;
  EXCEPTION 
    WHEN check_violation THEN
      RAISE NOTICE 'PASS: % - Correctly rejected unsorted buddy pair (user_id_1 < user_id_2 check).', test_name;
    WHEN OTHERS THEN
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
  END;

  -----------------------------------------------------------------------------
  -- TEST 4: Buddy uniqueness constraint
  -----------------------------------------------------------------------------
  test_name := 'Test 4: Buddy Uniqueness Constraint';
  BEGIN
    -- Insert first valid pair
    INSERT INTO public.buddies (user_id_1, user_id_2, status)
    VALUES (user_a_id, user_b_id, 'accepted');

    -- Attempt to insert the identical pair again
    INSERT INTO public.buddies (user_id_1, user_id_2, status)
    VALUES (user_a_id, user_b_id, 'pending');

    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Allowed duplicate buddy pair insertion.', test_name;
  EXCEPTION 
    WHEN unique_violation THEN
      RAISE NOTICE 'PASS: % - Correctly blocked duplicate buddy pair record.', test_name;
    WHEN OTHERS THEN
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
  END;

  -----------------------------------------------------------------------------
  -- PREPARE CHAT AND PLANS FOR RLS TESTING
  -----------------------------------------------------------------------------
  -- Create conversations
  INSERT INTO public.conversations (id, is_group) VALUES (convo_a_id, false);
  INSERT INTO public.conversations (id, is_group) VALUES (convo_b_id, false);

  -- Add members
  -- Conversation A members: User A and User B
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (convo_a_id, user_a_id);
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (convo_a_id, user_b_id);

  -- Conversation B members: User B and User C
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (convo_b_id, user_b_id);
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (convo_b_id, user_c_id);

  -- Add messages
  INSERT INTO public.messages (id, conversation_id, sender_id, content)
  VALUES (msg_a_id, convo_a_id, user_a_id, 'Secret conversation A message');

  INSERT INTO public.messages (id, conversation_id, sender_id, content)
  VALUES (msg_b_id, convo_b_id, user_b_id, 'Secret conversation B message');

  -- Add private plan under Conversation B (hosted by User B)
  INSERT INTO public.plans (id, host_id, conversation_id, title, event_time, venue, menu, is_public)
  VALUES (plan_b_id, user_b_id, convo_b_id, 'Private Beer Mixer', '2026-06-10 20:00:00+00', 'Secret Bar', 'Secret Menu', false);

  -----------------------------------------------------------------------------
  -- TEST 5: Profile RLS (Attempting to update another user''s profile)
  -----------------------------------------------------------------------------
  test_name := 'Test 5: Profile RLS (Cannot update another profile)';
  BEGIN
    -- Set role to authenticated and impersonate User A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_a_id), true);

    -- Try to update User B''s profile
    UPDATE public.profiles SET username = 'hacked_name' WHERE id = user_b_id;

    -- Reset to admin to check the results
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    IF (SELECT username FROM public.profiles WHERE id = user_b_id) = 'hacked_name' THEN
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - User A bypassed RLS and updated User B''s profile.', test_name;
    ELSE
      RAISE NOTICE 'PASS: % - Profile RLS successfully blocked User A from updating User B''s profile.', test_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- TEST 6: Chat RLS (Select messages in own conversation)
  -----------------------------------------------------------------------------
  test_name := 'Test 6: Chat RLS (Can select messages in own conversation)';
  BEGIN
    -- Impersonate User A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_a_id), true);

    SELECT count(*) INTO msg_count FROM public.messages WHERE conversation_id = convo_a_id;

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    IF msg_count = 1 THEN
      RAISE NOTICE 'PASS: % - User A successfully selected message in Conversation A.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - User A could not select message in Conversation A (got % rows).', test_name, msg_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- TEST 7: Chat RLS (Select messages in unauthorized conversation)
  -----------------------------------------------------------------------------
  test_name := 'Test 7: Chat RLS (Cannot select messages in unauthorized conversation)';
  BEGIN
    -- Impersonate User A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_a_id), true);

    -- Try to read messages in Conversation B (User A is NOT a member)
    SELECT count(*) INTO msg_count FROM public.messages WHERE conversation_id = convo_b_id;

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    IF msg_count = 0 THEN
      RAISE NOTICE 'PASS: % - User A was filtered from reading messages in Conversation B.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - User A read % message(s) in Conversation B (unauthorized).', test_name, msg_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- TEST 8: Chat RLS (Select private plan in unauthorized conversation)
  -----------------------------------------------------------------------------
  test_name := 'Test 8: Chat RLS (Cannot select private plan in unauthorized conversation)';
  BEGIN
    -- Impersonate User A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_a_id), true);

    -- Try to read private plan B
    SELECT count(*) INTO plan_count FROM public.plans WHERE id = plan_b_id;

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    IF plan_count = 0 THEN
      RAISE NOTICE 'PASS: % - User A was filtered from reading private plan B.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - User A successfully bypassed RLS and read private plan B.', test_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- TEST 9: Chat RLS (Insert message in unauthorized conversation)
  -----------------------------------------------------------------------------
  test_name := 'Test 9: Chat RLS (Cannot insert message in unauthorized conversation)';
  BEGIN
    -- Impersonate User A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_a_id), true);

    -- Try to insert message into Conversation B
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (convo_b_id, user_a_id, 'Malicious Message');

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - User A successfully inserted message into Conversation B.', test_name;
  EXCEPTION 
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS: % - User A was blocked by RLS policies from sending messages to Conversation B.', test_name;
      PERFORM set_config('role', 'postgres', true);
      PERFORM set_config('request.jwt.claims', '', true);
    WHEN OTHERS THEN
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
      PERFORM set_config('role', 'postgres', true);
      PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- TEST 10: Buddy RLS (Cannot update status of unrelated buddy record)
  -----------------------------------------------------------------------------
  test_name := 'Test 10: Buddy RLS (Cannot update unrelated buddy relationship)';
  BEGIN
    -- Impersonate User C
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_c_id), true);

    -- Try to update buddy status of A and B
    UPDATE public.buddies SET status = 'blocked' 
    WHERE user_id_1 = user_a_id AND user_id_2 = user_b_id;

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- Verify the status was NOT changed to blocked (it was set to 'accepted' earlier)
    IF (SELECT status FROM public.buddies WHERE user_id_1 = user_a_id AND user_id_2 = user_b_id) = 'blocked' THEN
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - User C bypassed RLS and changed User A & B''s buddy status.', test_name;
    ELSE
      RAISE NOTICE 'PASS: % - Buddy RLS successfully blocked User C from altering User A & B''s relationship.', test_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- SUITE WRAPUP
  -----------------------------------------------------------------------------
  RAISE NOTICE '==================================================';
  IF failed_tests > 0 THEN
    RAISE EXCEPTION 'QA VERIFICATION FAILED: % test(s) failed.', failed_tests;
  ELSE
    RAISE NOTICE 'QA VERIFICATION PASSED: All 10 tests passed successfully!';
    RAISE EXCEPTION 'ROLLBACK_SUCCESS';
  END IF;

END;
$$;

