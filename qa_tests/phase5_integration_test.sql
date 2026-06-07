-- Phase 5 Group Parties & Collaborative Canvas Integration Test Suite
-- Simulates collaborative canvas RLS validation and House Party RSVP gates.
-- Wraps entire test in a single DO block that raises a custom exception to force rollback.

DO $$
DECLARE
  failed_tests INTEGER := 0;
  test_name TEXT;
  plan_count INTEGER;
  msg_count INTEGER;
  user_a_id UUID := '44444444-4444-4444-4444-444444444444';
  user_b_id UUID := '55555555-5555-5555-5555-555555555555';
  user_c_id UUID := '66666666-6666-6666-6666-666666666666';
  private_convo_id UUID := 'c1000000-0000-0000-0000-00000000000c';
  group_convo_id UUID := 'c2000000-0000-0000-0000-00000000000c';
  private_plan_id UUID := '11111111-0000-0000-0000-00000000000c';
  group_plan_id UUID := '22222222-0000-0000-0000-00000000000c';
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'STARTING INTEGRATION & PENETRATION TEST (PHASE 5)';
  RAISE NOTICE '==================================================';

  -----------------------------------------------------------------------------
  -- STEP 1: Setup & Mocking
  -----------------------------------------------------------------------------
  test_name := 'Step 1: Setup & User Mocking';
  BEGIN
    -- Insert Mock Users A, B, and C
    INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
    VALUES (user_a_id, 'usera@example.com', 'authenticated', 'authenticated', '{"date_of_birth": "1995-05-05", "username": "usera"}'::jsonb);

    INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
    VALUES (user_b_id, 'userb@example.com', 'authenticated', 'authenticated', '{"date_of_birth": "1996-06-06", "username": "userb"}'::jsonb);

    INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
    VALUES (user_c_id, 'userc@example.com', 'authenticated', 'authenticated', '{"date_of_birth": "1997-07-07", "username": "userc"}'::jsonb);

    -- Setup private 1-on-1 match between User A and User B
    INSERT INTO public.buddies (user_id_1, user_id_2, status)
    VALUES (user_a_id, user_b_id, 'accepted');

    -- Insert Private Conversation
    INSERT INTO public.conversations (id, is_group)
    VALUES (private_convo_id, false);

    -- Insert Members for Private Conversation
    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES 
      (private_convo_id, user_a_id),
      (private_convo_id, user_b_id);

    -- Insert Private Plan by User A
    INSERT INTO public.plans (id, host_id, conversation_id, title, event_time, venue, menu, is_public)
    VALUES (
      private_plan_id, 
      user_a_id, 
      private_convo_id, 
      'Private Bar Hangout', 
      timezone('utc'::text, now()) + interval '5 hours', 
      'TBD Bar', 
      'IPA Beers', 
      false
    );

    RAISE NOTICE 'PASS: % - Setup complete with users, private buddy chat, and private plan.', test_name;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
  END;

  -----------------------------------------------------------------------------
  -- STEP 2: Collaborative Canvas RLS Penetration (Private Plan)
  -----------------------------------------------------------------------------
  -- Outsider User C tries to update private plan venue
  test_name := 'Step 2a: Private Canvas Update (Outsider Block)';
  BEGIN
    -- Impersonate User C
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_c_id), true);

    -- Attempt to update private plan
    UPDATE public.plans 
    SET venue = 'Infiltrated Lounge'
    WHERE id = private_plan_id;

    -- Reset to admin to assert
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- Check if it actually updated
    IF EXISTS (
      SELECT 1 FROM public.plans WHERE id = private_plan_id AND venue = 'Infiltrated Lounge'
    ) THEN
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Outsider User C successfully updated the private plan venue!', test_name;
    ELSE
      RAISE NOTICE 'PASS: % - Outsider User C update attempt was blocked by RLS policies.', test_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -- Buddy Member User B tries to update private plan menu
  test_name := 'Step 2b: Private Canvas Update (Member Allow)';
  BEGIN
    -- Impersonate User B
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_b_id), true);

    -- Attempt to update private plan
    UPDATE public.plans 
    SET menu = 'Draft Stout & Whiskey'
    WHERE id = private_plan_id;

    -- Reset to admin to assert
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- Check if it updated
    IF EXISTS (
      SELECT 1 FROM public.plans WHERE id = private_plan_id AND menu = 'Draft Stout & Whiskey'
    ) THEN
      RAISE NOTICE 'PASS: % - Member User B successfully updated the collaborative canvas menu.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Member User B was blocked from updating the plan menu.', test_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -- Outsider User C tries to insert themselves into private_convo_id
  test_name := 'Step 2c: Private Junction Infiltration (Outsider Block)';
  BEGIN
    -- Impersonate User C
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_c_id), true);

    -- Attempt to insert membership into private convo
    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (private_convo_id, user_c_id);

    -- Reset to admin to assert
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Outsider User C successfully infiltrated a private direct conversation!', test_name;
  EXCEPTION 
    WHEN insufficient_privilege OR check_violation THEN
      -- Reset to admin
      PERFORM set_config('role', 'postgres', true);
      PERFORM set_config('request.jwt.claims', '', true);
      RAISE NOTICE 'PASS: % - Outsider User C was blocked by RLS from joining a private conversation.', test_name;
    WHEN OTHERS THEN
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
      PERFORM set_config('role', 'postgres', true);
      PERFORM set_config('request.jwt.claims', '', true);
  END;


  -----------------------------------------------------------------------------
  -- STEP 3: House Party RSVP RLS (Public Plan / Group Chat)
  -----------------------------------------------------------------------------
  test_name := 'Step 3: Public Party Plan Setup';
  BEGIN
    -- Impersonate User A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_a_id), true);

    -- Create public group conversation
    INSERT INTO public.conversations (id, is_group)
    VALUES (group_convo_id, true);

    -- Add User A as host
    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (group_convo_id, user_a_id);

    -- Create public plan (House Party)
    INSERT INTO public.plans (id, host_id, conversation_id, title, event_time, venue, menu, is_public)
    VALUES (
      group_plan_id, 
      user_a_id, 
      group_convo_id, 
      'Neon Pre-Game Party', 
      timezone('utc'::text, now()) + interval '24 hours', 
      'Paddys Pub', 
      'Craft Cocktails & Wine', 
      true
    );

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    RAISE NOTICE 'PASS: % - Public House Party plan created.', test_name;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Setup exception: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -- Outsider User C selects public plan (should be visible in feed)
  test_name := 'Step 3a: Select Public Plan (Feed Visibility)';
  BEGIN
    -- Impersonate User C
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_c_id), true);

    SELECT count(*) INTO plan_count FROM public.plans WHERE id = group_plan_id;

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    IF plan_count = 1 THEN
      RAISE NOTICE 'PASS: % - Outsider User C can read the public plan details.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Public plan was hidden from outsider User C.', test_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -- Outsider User C tries to read messages in group conversation before RSVPing
  test_name := 'Step 3b: Select Group Messages before RSVP (Gate Block)';
  BEGIN
    -- Insert a message as Host User A
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (group_convo_id, user_a_id, 'Welcome to Paddys! Punch is in the back.');

    -- Impersonate User C
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_c_id), true);

    -- Try to read messages
    SELECT count(*) INTO msg_count FROM public.messages WHERE conversation_id = group_convo_id;

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    IF msg_count = 0 THEN
      RAISE NOTICE 'PASS: % - Outsider User C was blocked from reading group chat messages before RSVP.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Outsider User C read % message(s) without RSVPing!', test_name, msg_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -- User C RSVPs to the party
  test_name := 'Step 3c: RSVP to Group Party';
  BEGIN
    -- Impersonate User C
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_c_id), true);

    -- Insert membership record (RSVP)
    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (group_convo_id, user_c_id);

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    RAISE NOTICE 'PASS: % - User C successfully inserted RSVP into conversation_members.', test_name;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Unexpected RSVP failure: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -- Outsider User C reads messages in group conversation AFTER RSVPing
  test_name := 'Step 3d: Select Group Messages after RSVP (Gate Allow)';
  BEGIN
    -- Impersonate User C
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_c_id), true);

    -- Try to read messages
    SELECT count(*) INTO msg_count FROM public.messages WHERE conversation_id = group_convo_id;

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    IF msg_count = 1 THEN
      RAISE NOTICE 'PASS: % - Joined User C can successfully read group chat messages after RSVP.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - RSVPed User C was blocked from reading messages (returned % rows).', test_name, msg_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- SUITE WRAPUP
  -----------------------------------------------------------------------------
  RAISE NOTICE '==================================================';
  IF failed_tests > 0 THEN
    RAISE EXCEPTION 'PHASE 5 INTEGRATION VERIFICATION FAILED: % test(s) failed.', failed_tests;
  ELSE
    RAISE NOTICE 'PHASE 5 INTEGRATION VERIFICATION PASSED: All Phase 5 collaborative & group RLS scenarios secure!';
    -- Raise custom exception to force clean rollback
    RAISE EXCEPTION 'ROLLBACK_SUCCESS';
  END IF;

END;
$$;
