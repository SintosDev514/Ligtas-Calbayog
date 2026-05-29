# Ligtas Calbayog - Database Schema Documentation

## Required Supabase Tables

### 1. `crime_reports` (Existing - Enhanced)

Stores all crime/incident reports submitted by residents.

**Columns:**

- `id` (UUID) - Primary key
- `resident_id` (UUID) - FK to auth.users
- `crime_type` (TEXT) - e.g., "hit-and-run", "robbery", "theft", "assault", etc.
- `description` (TEXT) - Detailed description of the incident
- `latitude` (DECIMAL) - GPS latitude coordinate
- `longitude` (DECIMAL) - GPS longitude coordinate
- `location_address` (TEXT) - Human-readable address
- `share_live_location` (BOOLEAN) - Whether resident shares live location tracking
- `photo_url` (TEXT) - URL(s) of attached evidence photos/videos (comma-separated)
- `status` (TEXT) - "pending", "under-review", "in-progress", "resolved", "dismissed"
- `created_at` (TIMESTAMP) - Report submission time
- `updated_at` (TIMESTAMP) - Last status update time

**Indexes:**

- `resident_id` (for filtering by resident)
- `status` (for filtering by status)
- `created_at` (for sorting)

---

### 2. `report_feedback` (NEW)

Police officer responses and feedback for submitted reports.

**Columns:**

- `id` (UUID) - Primary key
- `report_id` (UUID) - FK to crime_reports
- `officer_id` (UUID) - FK to police officer profile
- `officer_name` (TEXT) - Name of responding officer
- `response_message` (TEXT) - Officer's response/feedback
- `estimated_arrival` (TEXT) - Estimated time of arrival (e.g., "10 minutes")
- `action_taken` (TEXT) - What action was taken
- `created_at` (TIMESTAMP) - When feedback was provided
- `updated_at` (TIMESTAMP) - Last update time

**Indexes:**

- `report_id` (for fetching feedback by report)
- `created_at` (for chronological ordering)

---

### 3. `action_updates` (NEW)

Timeline of actions and updates for ongoing reports.

**Columns:**

- `id` (UUID) - Primary key
- `report_id` (UUID) - FK to crime_reports
- `action_type` (TEXT) - e.g., "dispatch_sent", "officer_arrived", "investigation_started", "evidence_collected", "suspect_identified"
- `description` (TEXT) - Details of the action
- `officer_id` (UUID) - FK to police officer profile (optional)
- `status` (TEXT) - Status after this action
- `created_at` (TIMESTAMP) - When action occurred

**Indexes:**

- `report_id` (for fetching timeline by report)
- `created_at` (for chronological ordering)

---

### 4. `announcements` (Existing)

Public announcements and notices from PNP Calbayog.

**Columns:**

- `id` (UUID) - Primary key
- `title` (TEXT) - Announcement title
- `content` (TEXT) or `body` (TEXT) - Full announcement content
- `category` (TEXT) - "advisory", "alert", "news", "event", etc.
- `created_at` (TIMESTAMP) - Publication date
- `updated_at` (TIMESTAMP) - Last update time

**Indexes:**

- `created_at` (for sorting)
- `category` (for filtering by type)

---

### 5. `resident_profiles` (Existing)

User profile information for residents.

**Columns:**

- `id` (UUID) - Primary key / FK to auth.users
- `first_name` (TEXT)
- `last_name` (TEXT)
- `phone_number` (TEXT)
- `address` (TEXT)
- `city` (TEXT)
- `notifications_enabled` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

## Row Level Security (RLS) Policies

### crime_reports

- ✅ Residents can SELECT their own reports
- ✅ Residents can INSERT their own reports
- ✅ Police can SELECT/UPDATE all reports
- ✅ Residents cannot UPDATE/DELETE reports

### report_feedback

- ✅ Residents can SELECT feedback on their own reports
- ✅ Police can INSERT/UPDATE feedback
- ✅ Public readable

### action_updates

- ✅ Residents can SELECT updates on their own reports
- ✅ Police can INSERT/UPDATE updates

### announcements

- ✅ Public readable
- ✅ Only police can INSERT/UPDATE/DELETE

---

## Storage Buckets

### `report-photos`

- Stores evidence photos and videos uploaded with reports
- Public URL access enabled for residents to view their own evidence
- Suggested max file size: 50MB per file

---

## Real-time Subscriptions

The app uses Supabase real-time for live updates:

```typescript
// Subscribe to report status changes
supabase
  .channel(`report:${reportId}`)
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "crime_reports",
      filter: `id=eq.${reportId}`,
    },
    callback,
  )
  .subscribe();

// Subscribe to new feedback
supabase
  .channel(`report:${reportId}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "report_feedback",
      filter: `report_id=eq.${reportId}`,
    },
    callback,
  )
  .subscribe();

// Subscribe to action updates
supabase
  .channel(`report:${reportId}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "action_updates",
      filter: `report_id=eq.${reportId}`,
    },
    callback,
  )
  .subscribe();
```

---

## Implementation Notes

1. **Data Encryption**: Consider encrypting sensitive fields like coordinates and detailed descriptions
2. **Audit Trail**: Implement audit logging for all police actions on reports
3. **Notifications**: Set up triggers to send SMS/push notifications when:
   - Report is received
   - Report status changes
   - Feedback is provided
   - Action updates are added
4. **Performance**: Use database indexes and pagination for efficient querying
5. **Compliance**: Ensure all data handling complies with Philippine Data Privacy Act
