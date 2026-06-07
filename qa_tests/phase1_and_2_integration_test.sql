-- Phase 1 & 2 Integration Test Suite
-- Simulates the user journey: auth registration -> profile trigger -> profile details setup.
-- Wraps entire test in a DO block and raises a custom exception to force rollback.

DO $$
DECLARE
  failed_tests INTEGER := 0;
  test_name TEXT;
  mock_user_id UUID := '77777777-7777-7777-7777-777777777777';
  attacker_user_id UUID := '88888888-8888-8888-8888-888888888888';
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'STARTING INTEGRATION & SECURITY TEST (PHASE 1 & 2)';
  RAISE NOTICE '==================================================';

  -----------------------------------------------------------------------------
  -- STEP 1: Mock SignUp (auth.users insertion with metadata)
  -----------------------------------------------------------------------------
  test_name := 'Step 1: Mock SignUp (auth.users insert)';
  BEGIN
    INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
    VALUES (
      mock_user_id, 
      'integrator@example.com', 
      'authenticated', 
      'authenticated', 
      '{"date_of_birth": "1998-08-08", "username": "test_integrator"}'::jsonb
    );
    RAISE NOTICE 'PASS: % - Mock user inserted into auth.users.', test_name;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
  END;

  -----------------------------------------------------------------------------
  -- STEP 2: Assert Trigger Action (public.profiles auto-creation)
  -----------------------------------------------------------------------------
  test_name := 'Step 2: Assert Profile Auto-Creation Trigger';
  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = mock_user_id AND username = 'test_integrator' AND date_of_birth = '1998-08-08'
    ) THEN
      RAISE NOTICE 'PASS: % - Profile successfully auto-created by database trigger.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Profile row not found or contains incorrect values.', test_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
  END;

  -----------------------------------------------------------------------------
  -- STEP 3: Update Profile (Drink DNA & Intents under Owner RLS)
  -----------------------------------------------------------------------------
  test_name := 'Step 3: Update Profile (Drink DNA & Intents under Owner RLS)';
  BEGIN
    -- Set role to authenticated and impersonate the signed-up user
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', mock_user_id), true);

    -- Perform the update (adding Drink DNA preferences and intents)
    UPDATE public.profiles 
    SET 
      drink_preferences = ARRAY['Wine', 'Craft Beer']::TEXT[],
      intents = ARRAY['1-on-1', 'group']::TEXT[]
    WHERE id = mock_user_id;

    -- Reset to admin to check results
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- Verify the update was successfully committed
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = mock_user_id 
        AND drink_preferences = ARRAY['Wine', 'Craft Beer']::TEXT[]
        AND intents = ARRAY['1-on-1', 'group']::TEXT[]
    ) THEN
      RAISE NOTICE 'PASS: % - Profile successfully updated with Drink DNA & Intents by the owner.', test_name;
    ELSE
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Profile update was not applied or contains wrong data.', test_name;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    failed_tests := failed_tests + 1;
    RAISE WARNING 'FAIL: % - Exception occurred: %', test_name, SQLERRM;
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);
  END;

  -----------------------------------------------------------------------------
  -- STEP 4: Prevent Unauthorized Profile Update (RLS Verification)
  -----------------------------------------------------------------------------
  test_name := 'Step 4: Prevent Unauthorized Profile Update (RLS Violation Check)';
  BEGIN
    -- Insert another mock user for the attacker
    INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
    VALUES (
      attacker_user_id, 
      'attacker@example.com', 
      'authenticated', 
      'authenticated', 
      '{"date_of_birth": "1994-04-04", "username": "attacker"}'::jsonb
    );

    -- Impersonate the attacker
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', attacker_user_id), true);

    -- Try to modify the original user's Drink DNA and intents
    UPDATE public.profiles 
    SET 
      drink_preferences = ARRAY['Sober-Curious']::TEXT[],
      intents = ARRAY['group']::TEXT[]
    WHERE id = mock_user_id;

    -- Reset to admin to check results
    PERFORM set_config('role', 'postgres', true);
    PERFORM set_config('request.jwt.claims', '', true);

    -- Verify that the profile was NOT updated by the attacker
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = mock_user_id 
        AND drink_preferences = ARRAY['Sober-Curious']::TEXT[]
    ) THEN
      failed_tests := failed_tests + 1;
      RAISE WARNING 'FAIL: % - Attacker successfully bypassed RLS to update another user''s profile.', test_name;
    ELSE
      RAISE NOTICE 'PASS: % - Profile RLS successfully blocked the unauthorized update.', test_name;
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
    RAISE EXCEPTION 'INTEGRATION VERIFICATION FAILED: % test(s) failed.', failed_tests;
  ELSE
    RAISE NOTICE 'INTEGRATION VERIFICATION PASSED: All integration scenarios verified!';
    -- Raise a custom exception to force rollback of all inserts/changes, keeping the DB clean.
    RAISE EXCEPTION 'ROLLBACK_SUCCESS';
  END IF;

END;
$$;
