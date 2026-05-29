# Police Dashboard - Backend Setup Guide

This guide explains how to set up the police/admin side of the Ligtas Calbayog system to respond to reports and send feedback to residents.

---

## Overview

The police dashboard needs to handle:

1. Viewing submitted reports
2. Sending feedback to residents
3. Updating action timeline
4. Managing announcements

---

## Required API Endpoints

### Report Management

#### Get All Reports (with filtering)

```
GET /api/reports
Query Params: status, crime_type, date_from, date_to, limit, offset
Response: { reports: [], total: number }
```

#### Get Single Report Details

```
GET /api/reports/{reportId}
Response: {
  id, resident_id, crime_type, description,
  latitude, longitude, location_address,
  photo_url, status, created_at
}
```

#### List Reports in My Zone

```
GET /api/reports/zone/{zoneId}
Response: { reports: [], count: number }
```

---

### Feedback Management

#### Send Police Feedback

```
POST /api/reports/{reportId}/feedback
Body: {
  officer_id, officer_name, response_message,
  estimated_arrival, action_taken
}
Response: { success: true, feedback_id: uuid }
```

#### Update Existing Feedback

```
PUT /api/reports/{reportId}/feedback/{feedbackId}
Body: {
  response_message, estimated_arrival, action_taken
}
Response: { success: true }
```

---

### Action Timeline Management

#### Add Action Update

```
POST /api/reports/{reportId}/actions
Body: {
  action_type, description, officer_id, status
}
Response: { success: true, action_id: uuid }
```

#### Get Action Timeline

```
GET /api/reports/{reportId}/actions
Response: [
  {
    id, action_type, description, officer_id,
    status, created_at
  }
]
```

---

### Announcement Management

#### Create Announcement

```
POST /api/announcements
Body: {
  title, content, category, author_id
}
Response: { success: true, announcement_id: uuid }
```

#### Update Announcement

```
PUT /api/announcements/{announcementId}
Body: {
  title, content, category
}
Response: { success: true }
```

#### Delete Announcement

```
DELETE /api/announcements/{announcementId}
Response: { success: true }
```

---

## Database Operations (Backend)

### Insert Police Feedback (SQL Example)

```sql
INSERT INTO report_feedback (
  report_id, officer_id, officer_name,
  response_message, estimated_arrival,
  action_taken, created_at
) VALUES (
  $1, $2, $3, $4, $5, $6, NOW()
) RETURNING id;
```

### Insert Action Update

```sql
INSERT INTO action_updates (
  report_id, action_type, description,
  officer_id, status, created_at
) VALUES (
  $1, $2, $3, $4, $5, NOW()
) RETURNING id;

-- Also update the crime_report status
UPDATE crime_reports
SET status = $1, updated_at = NOW()
WHERE id = $2;
```

### Create Announcement

```sql
INSERT INTO announcements (
  title, content, category, author_id, created_at
) VALUES (
  $1, $2, $3, $4, NOW()
) RETURNING id;
```

---

## Real-time Broadcasting

### After Sending Feedback:

```typescript
// Broadcast to the resident
supabase.channel(`report:${reportId}`).send({
  type: "broadcast",
  event: "new_feedback",
  payload: feedbackData,
});
```

### After Adding Action Update:

```typescript
// Broadcast to the resident
supabase.channel(`report:${reportId}`).send({
  type: "broadcast",
  event: "action_update",
  payload: actionData,
});
```

### After Updating Report Status:

```typescript
// Update the record (auto-broadcasts via PostgreSQL changes)
const { error } = await supabase
  .from("crime_reports")
  .update({ status: "in-progress" })
  .eq("id", reportId);
```

---

## Police Dashboard UI Components (React)

### Reports List Component

```typescript
interface ReportListProps {
  zone: string;
  filters: {
    status?: string;
    crimeType?: string;
    dateRange?: [Date, Date];
  };
}

const ReportsList: React.FC<ReportListProps> = ({ zone, filters }) => {
  // 1. Fetch reports based on filters
  // 2. Display in table/list with status colors
  // 3. Allow click to open detail view
  // 4. Show last update time
};
```

### Report Detail Component

```typescript
interface ReportDetailProps {
  reportId: string;
}

const ReportDetail: React.FC<ReportDetailProps> = ({ reportId }) => {
  // 1. Display all report info
  // 2. Show evidence photos/videos
  // 3. Display location on map
  // 4. Show existing feedback
  // 5. Show action timeline
  // 6. Form to send feedback
  // 7. Form to add action update
};
```

### Feedback Form Component

```typescript
interface FeedbackFormProps {
  reportId: string;
  onSuccess: () => void;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ reportId, onSuccess }) => {
  const [officer, setOfficer] = useState('');
  const [message, setMessage] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');

  const handleSubmit = async () => {
    // POST to /api/reports/{reportId}/feedback
    // Show success notification
    // Call onSuccess()
  };

  return (
    <form onSubmit={handleSubmit}>
      <input placeholder="Officer Name" value={officer} onChange={...} />
      <textarea placeholder="Response Message" value={message} onChange={...} />
      <input placeholder="Est. Arrival (e.g., 10 minutes)" value={arrivalTime} onChange={...} />
      <button type="submit">Send Response</button>
    </form>
  );
};
```

### Action Timeline Component

```typescript
interface ActionTimelineProps {
  reportId: string;
}

const ActionTimeline: React.FC<ActionTimelineProps> = ({ reportId }) => {
  const [actions, setActions] = useState([]);
  const [actionType, setActionType] = useState('');
  const [description, setDescription] = useState('');

  const handleAddAction = async () => {
    // POST to /api/reports/{reportId}/actions
    // Refresh timeline
  };

  return (
    <div>
      {/* Timeline view */}
      {actions.map(action => (
        <div key={action.id} className="timeline-item">
          <span className="action-type">{action.action_type}</span>
          <p>{action.description}</p>
          <time>{formatDate(action.created_at)}</time>
        </div>
      ))}

      {/* Add action form */}
      <form onSubmit={handleAddAction}>
        <select value={actionType} onChange={...}>
          <option value="">Select Action Type</option>
          <option value="dispatch_sent">Dispatch Sent</option>
          <option value="officer_arrived">Officer Arrived</option>
          <option value="investigation_started">Investigation Started</option>
          <option value="evidence_collected">Evidence Collected</option>
          <option value="suspect_identified">Suspect Identified</option>
        </select>
        <textarea placeholder="Description" value={description} onChange={...} />
        <button type="submit">Add Update</button>
      </form>
    </div>
  );
};
```

---

## Authentication

Police officers need:

- Email/Password login
- Role-based access control (RBAC)
- Zone/Area assignment
- Permission levels

### Supabase RLS Policy for Police:

```sql
-- Police can only see reports in their zone
CREATE POLICY "police_can_view_reports_in_zone"
  ON crime_reports FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM police_officers WHERE zone = ANY(crime_reports.zone_coverage))
  );

-- Police can create feedback
CREATE POLICY "police_can_create_feedback"
  ON report_feedback FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM police_officers)
  );

-- Police can create action updates
CREATE POLICY "police_can_create_actions"
  ON action_updates FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM police_officers)
  );
```

---

## Notifications

### Setup Email/SMS Alerts to Residents:

```typescript
// When feedback is sent
async function notifyResidentOfFeedback(reportId: string, feedback: any) {
  const resident = await getResident(reportId);

  // Send SMS
  await sendSMS(
    resident.phone,
    `Your report #${reportId} has been received. Officer ${feedback.officer_name} will arrive in ${feedback.estimated_arrival}.`,
  );

  // Send Email
  await sendEmail(
    resident.email,
    `Report Update: ${feedback.response_message}`,
  );

  // Send In-App Notification
  await createNotification(resident.id, {
    type: "police_response",
    title: "Police Response",
    message: feedback.response_message,
    reportId,
  });
}

// When action is added
async function notifyResidentOfAction(reportId: string, action: any) {
  const resident = await getResident(reportId);

  await sendSMS(
    resident.phone,
    `Report #${reportId} Update: ${action.description}`,
  );

  await createNotification(resident.id, {
    type: "action_update",
    title: action.action_type,
    message: action.description,
    reportId,
  });
}
```

---

## Monitoring & Analytics

### Metrics to Track:

1. **Response Time**:
   - Time from report submission to first police response
   - Average: < 15 minutes

2. **Report Status**:
   - % Pending
   - % Under Review
   - % In Progress
   - % Resolved
   - % Dismissed

3. **Report Types**:
   - Distribution by crime type
   - Hotspot areas

4. **Officer Performance**:
   - Reports handled
   - Average resolution time
   - Customer satisfaction

---

## Testing

### API Testing Checklist:

- [ ] Create new report via mobile app
- [ ] Verify report appears in police dashboard
- [ ] Send feedback from dashboard
- [ ] Verify resident receives feedback in app
- [ ] Add action update
- [ ] Verify resident sees update in timeline
- [ ] Update report status
- [ ] Verify status changes in real-time
- [ ] Create announcement
- [ ] Verify announcement appears on all resident devices

---

## Deployment

1. **Backend Server**:
   - Node.js/Express or similar
   - PostgreSQL connection to Supabase
   - Authentication middleware

2. **Environment Variables**:
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY (for server-side operations)
   - JWT_SECRET
   - SMS_API_KEY (Twilio or similar)
   - EMAIL_API_KEY (SendGrid or similar)

3. **Security**:
   - HTTPS only
   - Rate limiting on API endpoints
   - Input validation
   - SQL injection prevention

---

## Support

For questions about:

- Frontend resident app: See IMPLEMENTATION_GUIDE.md
- Database schema: See DATABASE_SCHEMA.md
- API design: Refer to this document
