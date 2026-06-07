# Boozele System State

## 1. Global Progress State
- [x] Phase 1: Database Architecture & Core Scaffolding (COMPLETED)
  - [x] Step 1.1: Local Repository Scaffolding & Environment Setup
  - [x] Step 1.2: Supabase Database Migration & PostGIS Setup
  - [x] Step 1.3: Relational Migration for Buddy System
  - [x] Step 1.4: Relational Migration for Private Plans & Real-Time Chat Infrastructure
  - [x] Step 1.5: Security Hardening (Row-Level Security Policies)
- [ ] Phase 2: Design Sync & Baseline Authentication (CURRENT)
  - [ ] Step 2.1: Stitch MCP UI Tokens Integration
  - [ ] Step 2.2: Supabase Auth & Age Verification Setup
- [ ] Phase 3: The Buddy Social List & Direct Messaging
  - [ ] Step 3.1: Buddy List UI Implementation
  - [ ] Step 3.2: Real-time 1-on-1 Messaging via Supabase Realtime
- [ ] Phase 4: Casual Discovery Engine
  - [ ] Step 4.1: Swipe Cards UI (Stitch MCP)
  - [ ] Step 4.2: PostGIS Nearby Query & Opt-in Matching Logic
- [ ] Phase 5: Instant Private Plans & Group Canvas
  - [ ] Step 5.1: Private Invite Modal & Group Chat Provisioning
  - [ ] Step 5.2: Real-time Venue/Menu Collaborative Block
- [ ] Phase 6: Public Community Core
  - [ ] Step 6.1: House Party Creation Form & Distance Feed
  - [ ] Step 6.2: RSVP Logic & Safety Warning Integration
- [ ] Phase 7: Optimization & QA
  - [ ] Step 7.1: Build Optimizations & Web Deployment

## 2. File System Directory (Current Footprint)
- **.agent/** - Agent skills configuration
- **.claude/** - Claude IDE setup
- **.git/** - Git repository configuration
- **.gitignore** - Git exclusion lists
- **.vscode/** - Visual Studio Code configurations
- **AGENTS.md** - Expo SDK instructions and constraints
- **app.json** - Expo application metadata and configuration
- **assets/** - Application static assets and images
- **CLAUDE.md** - Development shortcuts
- **LICENSE** - Project MIT license
- **package.json** - Node dependencies, web compatibility configuration, and scripts
- **package-lock.json** - Node dependency locking
- **PRD.md** - Product Requirement Document
- **README.md** - Scaffolding installation and development walkthrough
- **scripts/** - Expo project shell utilities
- **src/** - Core application source folder
  - **app/** - Expo Router file-system based routing views
  - **components/** - Modular and shared UI components
  - **constants/** - Visual system variables, colors, and margins
  - **hooks/** - Global React Hooks (color schemes, hydration hooks)
  - **declarations.d.ts** - TypeScript module typings for CSS/assets
  - **global.css** - Application CSS rules
- **supabase/** - Supabase backend settings and migrations
  - **migrations/** - Database schema migration SQL scripts
    - **20260607110045_create_profiles_and_auth_trigger.sql** - Initial profiles and auth triggers
    - **20260607110239_create_buddies_table.sql** - Relational migration for buddy graph system
    - **20260607110945_create_chat_and_plans.sql** - Relational migration for chat and plans
    - **20260607111025_enable_rls_and_policies.sql** - RLS security policies for all tables
- **SYSTEM_STATE.md** - Active database and state tracking engine
- **tsconfig.json** - Strict TypeScript compiler parameters

## 3. Engineering Changelog
### [2026-06-07T11:20:00+05:30] Phase 1, Step 1.5 Completed
- **RLS Policy Implementation:** Created migration file `supabase/migrations/20260607111025_enable_rls_and_policies.sql` containing strict table access controls.
- **Row Level Security Activation:** Explicitly executed `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` on tables `profiles`, `buddies`, `conversations`, `conversation_members`, `messages`, and `plans`.
- **Recursion-Free Chat Verification:** Defined security helper function `public.is_conversation_member` to evaluate user membership inside chat policies without recursion loops.
- **Access Control Rules:** Locked down:
  - `profiles`: SELECT allowed for authenticated discovery, UPDATE locked to owner (`id = auth.uid()`).
  - `buddies`: SELECT, INSERT, UPDATE, DELETE restricted to matching user IDs (`auth.uid() = user_id_1 OR auth.uid() = user_id_2`).
  - `conversations`, `conversation_members`, `messages`: Selective read/write limits applied based on active member checking in the respective channel.
  - `plans`: SELECT permitted for public plan feeds or matching chat participants; updates permitted only to the `host_id` or active plan conversation participants.
- **Phase Transition:** Concluded Phase 1 database design layout. Set Phase 2 as the active development segment.

### [2026-06-07T11:15:00+05:30] Phase 1, Step 1.4 Completed
- **Chat Relational Schema:** Created tables `conversations` (with `is_group` toggle to split direct and group chats) and `conversation_members` junction table with a compound primary key `(conversation_id, user_id)` preventing duplicate participant mappings.
- **Messaging Setup:** Designed the `messages` table referencing `conversations(id)` and `profiles(id)` for full user chat history.
- **Collaborative Plans Table:** Configured the `plans` table referencing `conversations(id)` with a `UNIQUE` constraint to maintain a 1:1 chat room linkage, accommodating `venue` and `menu` collaborative fields.
- **Plan Modifications Trigger:** Hooked the `update_plans_updated_at` trigger onto the `plans` table to automatically update `updated_at` on collaborative changes.

### [2026-06-07T11:10:00+05:30] Phase 1, Step 1.3 Completed
- **Buddy Table Migration:** Created `supabase/migrations/20260607110239_create_buddies_table.sql` with a custom `buddy_status` enum type (`'pending'`, `'accepted'`, `'blocked'`).
- **Duplicate Prevention Constraints:** Enforced sorted deterministic user ID ordering via `CONSTRAINT check_user_order CHECK (user_id_1 < user_id_2)` and a `UNIQUE (user_id_1, user_id_2)` constraint.
- **Auditing Trigger:** Built trigger `update_buddies_updated_at` calling `public.update_updated_at_column()` to keep relationship mod times synchronized dynamically.
- **Security Protocols:** Enabled RLS on the `buddies` table to permit only the referenced users to read, write, update, or delete their mutual records.

### [2026-06-07T11:05:00+05:30] Phase 1, Step 1.2 Completed
- **Migration Architecture:** Configured `supabase/migrations/` layout and created `20260607110045_create_profiles_and_auth_trigger.sql`.
- **Age Validation Constraint:** Built an immutable helper function `is_at_least_21` and linked it via a custom `CHECK` constraint on `profiles` to reject underage users dynamically.
- **Auth Trigger Integration:** Implemented the `handle_new_user` PL/pgSQL function and `on_auth_user_created` trigger on the `auth.users` table to auto-provision profile rows upon email or password signups.
- **Security Rules:** Enforced Row Level Security (RLS) policies on `public.profiles` permitting authenticated users to query profiles and update their own.

### [2026-06-07T10:45:00+05:30] Phase 1, Step 1.1 Completed
- **Project Scaffolding:** Scaffolded standard Expo React Native project with TypeScript and Expo Router using `create-expo-app` with active file backups to prevent configuration loss.
- **File Layout Verification:** Validated modular layout under `./src/` containing `/app` (Router), `/components` (UI), `/constants` (Tokens), and `/hooks` (Logic).
- **TypeScript Optimization:** Integrated `src/declarations.d.ts` defining modules for CSS stylesheets and image asset imports. Passed `npx tsc --noEmit` check with zero compiler warnings/errors.
- **Lint Resolution:** Added targeted eslint disables in `src/hooks/use-color-scheme.web.ts` for hydration state side-effects. Passed `npm run lint` check with zero linter errors/warnings.
- **Web Support Validation:** Inspected `package.json` and verified configuration compatibility for web platforms using `react-native-web`.
