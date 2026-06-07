# Product Requirement Document (PRD)

## 1. Project Metadata
- **Project Name:** Boozele
- **Author:** Senior System Architect & Product Strategist
- **Target Architecture:** Multi-platform (iOS, Android, Web) via React Native/Expo & Supabase
- **Design Paradigm:** Google Stitch via MCP (`DESIGN.md` integration)
- **Budget:** $0 (Strict Free-Tier Optimization)

---

## 2. Executive Summary & Value Proposition
Boozele is a hyperlocal social networking application designed to connect adults over shared social drinking experiences. Moving past traditional dating mechanics, Boozele adapts the familiar "swipe-to-match" paradigm exclusively for friend-making, group hangs, and community-driven event hosting (pub crawls, house parties, group mixers). 

The platform bridges the gap left by generic social discovery apps by setting an explicit, contextual expectation: expanding social circles through nightlife, casual drinks, and shared parties.

---

## 3. User Personas

### The Solo Explorer
*   **Profile:** Recently relocated professional or traveler who wants to experience the local nightlife but lacks a social group.
*   **Goal:** Quickly find 1–2 people to grab a drink with tonight without the romantic pressures of a dating app.

### The Social Anchor (The Host)
*   **Profile:** An outgoing local who loves organizing gatherings, pre-gaming sessions, or house parties.
*   **Goal:** Fill up empty slots for a weekend house party or aggregate a large group for a localized pub crawl.

---

## 4. Functional Requirements & Feature Breakdown

### 4.1 Authentication & Mandatory Age Verification
To mitigate liability risks inherently tied to alcohol-focused social mapping, access to the platform requires ironclad gateway checks.

*   **Requirements:**
    *   Authentication via Supabase Auth using passwordless Magic Links or standard Email/Password.
    *   Mandatory date-of-birth picker with a strict database-level constraint (`CHECK (age >= 21)` or regional equivalent) rejecting underage users.
    *   Explicit click-wrap acceptance of Liability & Safety Guidelines during registration.

### 4.2 Profile Creation & Drinking DNA
Profiles are structured to emphasize social compatibility over romantic intent.

*   **Requirements:**
    *   Minimum 2 profile photos (stored via Supabase Storage).
    *   **Drink Preferences tags:** Craft Beer, Wine, Cocktails, Non-Alcoholic/Sober-Curious, Whiskey, etc.
    *   **Intent toggles:** "Looking for 1-on-1 chill drinks" and/or "Looking for big group parties."
    *   **Discovery filters:** Filter potential connections by gender expression (Men, Women, Everyone), distance radius, and drink preference.

### 4.3 Core Discovery: Hyperlocal Matching (1-on-1)
*   **Requirements:**
    *   Card-stack swipe interface built on fetched Google Stitch MCP components.
    *   Real-time geospatial querying powered by Supabase PostGIS (`ST_DWithin`) to show profiles within a precise 0–25 km radius.
    *   Dual-opt-in match logic. Mutual right-swipes generate a Match record and automatically promote the users to "Buddies".

### 4.4 Community Core: Group Plans & House Parties (1-to-Many)
This module allows users to scale their social plans past 1-on-1 interactions.

| Feature Component | Functional Description | Data Source |
| :--- | :--- | :--- |
| **Plan Creation** | Host sets Title, Time, Location description, Max Capacity, and Party Tag. | Supabase `parties` Table |
| **Discovery Feed** | Chronological and distance-sorted feed of active public plans nearby. | PostGIS Radius Query |
| **RSVP Engine** | Users request to join. Host can auto-approve or manually review profiles. | Database Join State |

### 4.5 The Buddy Network & Instant Private Plans (Retention Core)
Transforms the app from a discovery tool to a lasting social utility.

*   **The Buddy Graph:** A distinct bidirectional relationship matrix (`buddies` table). Users can view their accepted "buddies," check active status, and initiate direct messages.
*   **Instant Private Plans:** A buddy can instantly select 1 or more buddies from their list, input a quick activity (e.g., "Grabbing beers at 8 PM"), and trigger an instant invite without creating a public feed event.
*   **Collaborative Group Canvas:** Accepting a private plan automatically provisions a dedicated group chat. This chat features a persistent, pinned schema block for **Venue** and **Menu** details that any participant can edit collaboratively in real-time.

### 4.6 Messaging Infrastructure
*   **Requirements:**
    *   Instant 1-on-1 text messaging unlocked immediately upon becoming Buddies.
    *   Automated Group Chat instantiation for both public RSVPs and Instant Private Plans.
    *   Real-time message state synchronization utilizing Supabase Realtime subscriptions.

---

## 5. Trust, Safety, & Risk Mitigation

Given the combination of alcohol and real-world meetups, user protection requires aggressive programmatic enforcement.

> **Zero-Tolerance Safety Protocol:** Every user profile, group plan, and chat screen must feature a persistent, single-tap "Report/Block" button.

*   **Row-Level Security (RLS):** Supabase RLS must be strictly enforced. Users can only read or write to chat messages if their explicit user UUID is registered to that specific match or party guest list.
*   **Plan Safety Disclaimers:** Every public plan details page must display a standardized legal warning: *Boozele does not vet private residences. Always meet in public spaces first and drink responsibly.*
*   **Ghosting/Unmatching:** Unmatching instantly destroys the backend database link and severs the real-time chat channel for both parties.

---

## 6. Non-Functional & Technical Requirements

### 6.1 Architecture & Stack Constraints
*   **Frontend Unified Build:** React Native with Expo Router compiled into iOS, Android, and web using TypeScript. Enable typed routes for strict compile-time navigation safety.
*   **UI System Pipeline:** Google Stitch via Model Context Protocol (MCP). The AI development agent must reference `.stitch/DESIGN.md` for spacing, typography tokens, and components.
*   **Zero-Cost Backend:** Supabase free-tier allocation. PostgreSQL handles relational data integrity, while PostGIS extensions handle geographical indices.

### 6.2 Performance & Scalability Boundaries
*   **Geospatial Efficiency:** Location lookups must execute using indexed bounding queries (`ST_DWithin`) to ensure query times remain under 200ms on free-tier compute.
*   **Offline State:** Graceful handling of network drops using client-side caching (`@react-native-async-storage/async-storage`) for loaded discovery cards and chat histories.

---

## 7. Granular Implementation Roadmap (For Antigravity Agent)
[Phase 1: DB & Architecture] ──> [Phase 2: Sync & Auth] ──> [Phase 3: Buddy & Chat] ──> [Phase 4: Casual Discovery] ──> [Phase 5 & 6: Plans & Public Parties]

*   **Phase 1 [Database Architecture & Core Scaffolding]:** Init Expo app. Create Supabase migrations for `profiles`, `buddies`, `conversations`, `messages`, and `plans`. Set up PostGIS and RLS.
*   **Phase 2 [Design Sync & Baseline Authentication]:** Extract `DESIGN.md` via Stitch MCP. Build Email/Password auth, mandatory age verification, and profile preference ingestion.
*   **Phase 3 [The Buddy Social List & Direct Messaging]:** Extract UI via Stitch MCP. Build the Buddy List interface and real-time 1-on-1 chat UI leveraging Supabase Realtime.
*   **Phase 4 [Casual Discovery Engine]:** Extract Swipe Cards via Stitch MCP. Implement PostGIS nearby queries and the dual-opt-in matching logic that triggers Buddy creation.
*   **Phase 5 [Instant Private Plans & Group Canvas]:** Build the multiselect invite modal. Automate group chat provisioning and implement the shared, real-time editable Venue/Menu schema block.
*   **Phase 6 [Public Community Core]:** Build the public House Party hosting form, distance-sorted feed, and RSVP loop with prominent safety disclaimers.
*   **Phase 7 [Optimization & QA]:** Resolve TypeScript errors, remove inline styles, deploy Web to Vercel, and validate mobile builds via Expo Go.