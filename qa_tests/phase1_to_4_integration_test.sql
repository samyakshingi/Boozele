-- Phase 1 to 4 Discovery & Match Integration Test Suite
-- Simulates location synchronization, PostGIS proximity query, swiping, mutual matching,
-- conversation provisioning, and swipes RLS isolation penetration checks.
-- Wraps entire test in a single DO block that raises a custom exception to force rollback.

DO $$
DECLARE
  failed_tests INTEGER := 0;
  test_name TEXT;
  returned_users_count INTEGER;
  swipe_result json;
  swipe_count INTEGER;
  convo_id UUID;
  user_a_id UUID := '44444444-4444-4444-4444-444444444444';
  user_b_id UUID := '55555555-5555-5555-5555-555555555555';
  user_c_id UUID := '66666666-6666-6666-6666-666666666666';
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'STARTING INTEGRATION & PENETRATION TEST (PHASE 1-4)';
  RAISE NOTICE '==================================================';



  -----------------------------------------------------------------------------
  -- STEP 1: Setup & Geospatial Mocking
  -----------------------------------------------------------------------------
  test_name := 'Step 1: Setup & Geospatial Mocking';
  BEGIN
    -- Insert Mock Users A, B, and C
    INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
    VALUES (user_a_id, 'usera@example.com', 'authenticated', 'authenticated', '{"date_of_birth": "1995-05-05", "username": "usera"}'::jsonb);

    INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
    VALUES (user_b_id, 'userb@example.com', 'authenticated', 'authenticated', '{"date_of_birth": "1996-06-06", "username": "userb"}'::jsonb);

    INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
    VALUES (user_c_id, 'userc@example.com', 'authenticated', 'authenticated', '{"date_of_birth": "1997-07-07", "username": "userc"}'::jsonb);

    -- Mock Locations
    -- User A (Reference Location): San Francisco - Lon -122.4194, Lat 37.7749
    UPDATE public.profiles 
    SET location = ST_MakePoint(-122.4194, 37.7749)::geography
    WHERE id = user_a_id;

    -- User B (Nearby Location): Lon -122.418, Lat 37.775 (approx 120 meters away - within 5km)
    UPDATE public.profiles 
    SET location = ST_MakePoint(-122.418, 37.775)::geography
    WHERE id = user_b_id;

    -- User C (Far Location): Lon -121.900, Lat 37.770 (approx 45km away - outside 30km limit)
    UPDATE public.profiles 
    SET location = ST_MakePoint(-121.900, 37.770)::geography
    WHERE id = user_c_id;

    RAISE NOTICE 'PASS: % - Users created and geospatial locations initialized.', test_name;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
  END;

  -----------------------------------------------------------------------------
  -- STEP 2: PostGIS Proximity Search Query Test
  -----------------------------------------------------------------------------
  test_name := 'Step 2: PostGIS Proximity Search Query (get_nearby_drinkers)';
  BEGIN
    -- Impersonate User A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_a_id), true);

    -- Execute proximity search centered on User A coordinates, with a 25km radius
    -- User B (120m away) should be returned, User C (28km away) should be excluded,
    -- and User A (the caller) should be excluded.
    
    -- Assert that User B is returned
    IF EXISTS (
      SELECT 1 FROM public.get_nearby_drinkers(37.7749, -122.4194, 25.0) 
      WHERE id = user_b_id
    ) THEN
      RAISE NOTICE 'PASS: % - User B successfully returned (within 25km).', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - User B not returned in proximity search.', test_name;
    END IF;

    -- Assert that User C is NOT returned
    IF NOT EXISTS (
      SELECT 1 FROM public.get_nearby_drinkers(37.7749, -122.4194, 25.0) 
      WHERE id = user_c_id
    ) THEN
      RAISE NOTICE 'PASS: % - Far User C correctly excluded (outside 25km).', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Far User C was incorrectly returned in search.', test_name;
    END IF;

    -- Assert that User A (the caller) is NOT returned
    IF NOT EXISTS (
      SELECT 1 FROM public.get_nearby_drinkers(37.7749, -122.4194, 25.0) 
      WHERE id = user_a_id
    ) THEN
      RAISE NOTICE 'PASS: % - Calling User A correctly excluded from their own discovery feed.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Calling User A was incorrectly returned in their own feed.', test_name;
    END IF;

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- STEP 3: Match RPC Test - One-Way Swipe (A right-swipes B)
  -----------------------------------------------------------------------------
  test_name := 'Step 3: Match RPC Test - One-Way Right Swipe (A swiping B)';
  BEGIN
    -- Impersonate User A
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_a_id), true);

    -- Call process_swipe(User B, true) as User A
    SELECT public.process_swipe(user_b_id, true) INTO swipe_result;

    -- Reset to admin to assert
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- Assert return payload is {is_match: false}
    IF (swipe_result->>'is_match')::boolean = false AND (swipe_result->>'conversation_id') IS NULL THEN
      RAISE NOTICE 'PASS: % - Swipe recorded, returned is_match = false.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Expected is_match: false, got is_match: %, conversation_id: %', test_name, swipe_result->>'is_match', swipe_result->>'conversation_id';
    END IF;

    -- Assert swipe row created in the swipes table
    IF EXISTS (
      SELECT 1 FROM public.swipes 
      WHERE swiper_id = user_a_id AND swiped_id = user_b_id AND is_right_swipe = true
    ) THEN
      RAISE NOTICE 'PASS: % - Swipe record created in table.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Swipe record was not created in swipes table.', test_name;
    END IF;

    -- Impersonate User A again to test feed filter
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_a_id), true);

    -- Execute get_nearby_drinkers again. User B should now be filtered out because they were already swiped.
    IF NOT EXISTS (
      SELECT 1 FROM public.get_nearby_drinkers(37.7749, -122.4194, 25.0) 
      WHERE id = user_b_id
    ) THEN
      RAISE NOTICE 'PASS: % - Already swiped User B is successfully filtered out of User A''s feed.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Swiped User B was not filtered.', test_name;
    END IF;

    -- Reset to admin
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- STEP 4: Match RPC Test - Mutual Swipe (B right-swipes A)
  -----------------------------------------------------------------------------
  test_name := 'Step 4: Match RPC Test - Mutual Right Swipe (B swiping A)';
  BEGIN
    -- Impersonate User B
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_b_id), true);

    -- Call process_swipe(User A, true) as User B
    SELECT public.process_swipe(user_a_id, true) INTO swipe_result;

    -- Reset to admin to assert
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- Assert return payload is {is_match: true} and conversation_id is generated
    IF (swipe_result->>'is_match')::boolean = true AND (swipe_result->>'conversation_id') IS NOT NULL THEN
      convo_id := (swipe_result->>'conversation_id')::UUID;
      RAISE NOTICE 'PASS: % - Mutual swipe succeeded. returned is_match: true, conversation_id: %', test_name, convo_id;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Expected is_match: true, got is_match: %, conversation_id: %', test_name, swipe_result->>'is_match', swipe_result->>'conversation_id';
    END IF;

    -- Assert buddies record is automatically created (accepted and sorted)
    IF EXISTS (
      SELECT 1 FROM public.buddies 
      WHERE user_id_1 = user_a_id AND user_id_2 = user_b_id AND status = 'accepted'
    ) THEN
      RAISE NOTICE 'PASS: % - Buddy record auto-created and accepted in sorted order.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Buddy record not created or not accepted in buddies table.', test_name;
    END IF;

    -- Assert conversation and memberships are automatically created
    IF EXISTS (SELECT 1 FROM public.conversations WHERE id = convo_id) THEN
      RAISE NOTICE 'PASS: % - Conversation record successfully created.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Conversation record not found for id %.', test_name, convo_id;
    END IF;

    IF EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = convo_id AND user_id = user_a_id)
       AND EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = convo_id AND user_id = user_b_id) THEN
      RAISE NOTICE 'PASS: % - Conversation members for both users successfully created.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Conversation members missing for convo %.', test_name, convo_id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Unexpected exception: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- STEP 5: RLS Penetration Test (Swipes Privacy)
  -----------------------------------------------------------------------------
  test_name := 'Step 5: RLS Penetration Test (Cannot view swipes of other users)';
  BEGIN
    -- Impersonate User B
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', user_b_id), true);

    -- Try to SELECT swipes where swiper_id is User A.
    -- Because of RLS, User B should not see User A's swipes.
    SELECT count(*) INTO swipe_count FROM public.swipes WHERE swiper_id = user_a_id;

    -- Reset to admin to assert
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    IF swipe_count = 0 THEN
      RAISE NOTICE 'PASS: % - User B was blocked from seeing User A''s swipe records (returned 0 rows).', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - User B successfully bypassed RLS and read % swipe record(s) from User A.', test_name, swipe_count;
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
    RAISE EXCEPTION 'PHASE 4 PENETRATION VERIFICATION FAILED: % test(s) failed.', failed_tests;
  ELSE
    RAISE NOTICE 'PHASE 4 PENETRATION VERIFICATION PASSED: All Phase 1-4 discovery & match scenarios secure!';
    -- Raise custom exception to force clean rollback
    RAISE EXCEPTION 'ROLLBACK_SUCCESS';
  END IF;

END;
$$;
