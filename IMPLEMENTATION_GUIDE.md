# Ligtas Calbayog - Implementation Guide

## Recent Updates & Features

### ✅ 1. Enhanced Crime Reporting System

#### Features:

- **Multi-Media Evidence**: Residents can attach photos and videos (up to 15-second clips) to their reports
- **GPS Location Tracking**: Automatic location capture with address reverse-geocoding
- **Real-time Submission**: Reports submitted with status tracking
- **Reference ID**: Every submitted report gets a unique reference ID for tracking

#### Files:

- `apps/resident-app/app/(tabs)/report.tsx` - Main reporting interface
- `shared/services/reportService.js` - Report submission logic

#### Database Requirements:

- `crime_reports` table with fields: crime_type, description, coordinates, photo_url, status

---

### ✅ 2. Police Feedback & Response System

#### Features:

- **Officer Response**: Police can provide feedback on submitted reports
- **Estimated Arrival Time**: Officer can specify when they'll arrive at scene
- **Real-time Updates**: Residents get instant notifications of police responses
- **Action Messages**: Police can communicate with residents about their report

#### Files:

- `shared/services/reportService.js` - Functions:
  - `fetchReportFeedback()` - Get police response
  - `subscribeToReportUpdates()` - Real-time listening

#### Database Requirements:

- `report_feedback` table with fields: officer_name, response_message, estimated_arrival
- Real-time subscriptions enabled in Supabase

---

### ✅ 3. Ongoing Action Tracking

#### Features:

- **Action Timeline**: Shows chronological updates of police actions
- **Action Types**: dispatch_sent, officer_arrived, investigation_started, evidence_collected, suspect_identified
- **Real-time Updates**: New actions appear instantly
- **Transparency**: Residents can see exactly what's happening with their report

#### Files:

- `apps/resident-app/app/(tabs)/my-reports.tsx` - Timeline display
- `shared/services/reportService.js` - Functions:
  - `fetchActionUpdates()` - Get action history
  - `subscribeToReportUpdates()` - Real-time listening

#### Display Components:

```typescript
// Ongoing Action Updates Section
{actionUpdates[item.id] && actionUpdates[item.id].length > 0 && (
  <View style={styles.expandedBlock}>
    <Text style={styles.blockLabel}>Ongoing Action Updates</Text>
    <View style={styles.timelineContainer}>
      {/* Timeline of actions with timestamps */}
    </View>
  </View>
)}
```

#### Database Requirements:

- `action_updates` table with fields: action_type, description, created_at, status

---

### ✅ 4. Report Status Transparency

#### Status Flow:

- **Pending** 🟡 - Report submitted, awaiting review
- **Under Review** 🔵 - Police reviewing the report
- **In Progress** 🟣 - Police responding/investigating
- **Resolved** 🟢 - Case closed
- **Dismissed** ⚫ - Report dismissed

#### Features:

- **Status Badge**: Clear visual indicator on each report
- **Filter by Status**: Residents can filter reports by current status
- **Status History**: Timeline shows how status changed over time
- **Color Coding**: Each status has distinct color for quick identification

#### Files:

- `apps/resident-app/app/(tabs)/my-reports.tsx` - Status display and filtering

---

### ✅ 5. Police Feedback Display

#### Features in "My Reports" Screen:

```
┌─────────────────────────────────┐
│  POLICE RESPONSE                │
│  ✓ Officer: John Santos         │
│  Message: We're dispatching...  │
│  Est. Arrival: 8 minutes        │
│  Received: Jan 15, 2:45 PM      │
└─────────────────────────────────┘
```

#### What's Displayed:

- Officer name responding to the report
- Police message/response text
- Estimated arrival time
- Timestamp of when response was given

#### Files:

- `apps/resident-app/app/(tabs)/my-reports.tsx` - Feedback section rendering

---

### ✅ 6. Report Success Modal

#### When Report is Submitted:

1. Success message appears
2. Reference ID displayed (save for tracking)
3. Information about next steps:
   - Expected response time: 5-15 minutes
   - Notification setup info
   - How to track progress
4. Two action buttons:
   - "View My Reports" - Go to track report
   - "File Another Report" - Submit another incident

#### Files:

- `apps/resident-app/app/(tabs)/report.tsx` - Success modal component

---

### ✅ 7. Community Announcements

#### Features:

- **Official PNP Notices**: Read latest police department announcements
- **Multiple Categories**: Advisory, Alert, News, Event
- **Easy Navigation**: Expand/collapse announcements to read full content
- **Pull-to-Refresh**: Update announcements manually
- **Time Stamps**: See how long ago announcement was posted

#### Categories:

- 🔵 **Advisory** - Information and guidance
- 🔴 **Alert** - Urgent warnings and alerts
- 🟢 **News** - Official news from PNP
- 🟣 **Event** - Community events and activities

#### Files:

- `apps/resident-app/app/(tabs)/announcements.tsx` - Announcements UI
- `shared/services/reportService.js` - `fetchAnnouncements()` function

#### Database Requirements:

- `announcements` table with fields: title, content, category, created_at

---

## Real-time Features Using Supabase

### How Real-time Works:

1. **Subscribe to Report Updates**:

   ```typescript
   const subscription = subscribeToReportUpdates(reportId, (payload) => {
     // Update UI when new feedback arrives
     // Update UI when new action is added
     // Update UI when status changes
   });
   ```

2. **What Triggers Updates**:
   - Police updates report status
   - Police submits feedback/response
   - Police adds action update
   - System processes report

3. **Automatic Refresh**:
   - Pull-to-refresh on My Reports screen
   - Manual refresh button
   - Auto-refresh on app focus

---

## Security Features

### Data Protection:

- ✅ User authentication required
- ✅ Location data encryption in transit
- ✅ Evidence files stored in secure bucket
- ✅ Row-level security on database
- ✅ Police can only access reports in their jurisdiction

### Privacy:

- ✅ Only residents can see their own reports
- ✅ Only assigned police officer can see feedback details
- ✅ Announcements are public
- ✅ Photo evidence access controlled per-resident

---

## User Flows

### Resident Reporting Flow:

```
1. Select Crime Type
   ↓
2. Allow GPS Access
   ↓
3. Capture Photo/Video Evidence (Optional)
   ↓
4. Add Incident Description
   ↓
5. Review & Submit Report
   ↓
6. Get Reference ID
   ↓
7. Receive Success Confirmation
```

### Tracking Report Flow:

```
1. Open "My Reports"
   ↓
2. See Report Status
   ↓
3. Tap to Expand Details
   ↓
4. View Police Feedback
   ↓
5. See Action Timeline
   ↓
6. Get Real-time Updates
```

### Police Response Flow:

```
1. Receive Report Alert
   ↓
2. Review Report Details
   ↓
3. Dispatch Officers
   ↓
4. Send Response Message
   ↓
5. Update Action Timeline
   ↓
6. Close Report
```

---

## API Functions

### Report Service Functions:

```typescript
// Submit a new report
submitCrimeReport({
  userId,
  crimeType,
  description,
  latitude,
  longitude,
  locationAddress,
  photoUrl,
});

// Fetch resident's reports
fetchResidentReports(userId);

// Get police feedback for a report
fetchReportFeedback(reportId);

// Get action timeline for a report
fetchActionUpdates(reportId);

// Subscribe to real-time updates
subscribeToReportUpdates(reportId, callback);

// Fetch announcements
fetchAnnouncements();

// Fetch resident profile
fetchResidentProfile(userId);
```

---

## Testing Checklist

- [ ] Submit a report with photos/videos
- [ ] Verify reference ID is displayed
- [ ] Check report appears in "My Reports"
- [ ] Filter reports by status
- [ ] Expand report to see full details
- [ ] Verify police feedback displays correctly
- [ ] Check action timeline updates in real-time
- [ ] Test pull-to-refresh on announcements
- [ ] Verify status badges show correct colors
- [ ] Test notification permissions
- [ ] Verify GPS location is accurate
- [ ] Test with various crime types
- [ ] Check evidence photos display correctly

---

## Deployment Considerations

1. **Supabase Setup**:
   - Create required tables (see DATABASE_SCHEMA.md)
   - Set up row-level security policies
   - Create storage bucket for photos
   - Enable real-time subscriptions

2. **Environment Variables**:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY

3. **Police Dashboard Backend** (To be developed):
   - API endpoints for police to manage reports
   - Dashboard UI to view pending reports
   - Interface to send feedback and updates
   - Dispatch management system

---

## Future Enhancements

1. **Push Notifications**:
   - Alert residents of status changes
   - Notify residents of police responses
   - Emergency alerts

2. **Advanced Mapping**:
   - Incident heat map
   - Multiple report clustering
   - Zone-based statistics

3. **Report Analytics**:
   - Crime statistics dashboard
   - Response time metrics
   - Resolution rate tracking

4. **Community Features**:
   - Report sharing between residents
   - Upvoting/validation of reports
   - Witness coordination

5. **Mobile Enhancements**:
   - Offline report drafting
   - Voice-to-text descriptions
   - Augmented reality evidence capture

---

## Support & Troubleshooting

### Common Issues:

**GPS not working?**

- Check location permissions in app settings
- Ensure device has clear sky view
- Try manual address entry option

**Reports not appearing?**

- Refresh the screen
- Check internet connection
- Verify authentication status

**No police feedback?**

- Police may not have responded yet
- Check notification settings
- Try manual refresh

**Photos not uploading?**

- Check file size (max 50MB per file)
- Verify storage bucket is accessible
- Check internet connection speed
