# Quick Start Guide - Ligtas Calbayog

Get the Ligtas Calbayog app running locally in minutes!

---

## Prerequisites

- Node.js 16+ and npm
- Expo CLI: `npm install -g expo-cli`
- Android/iOS device or emulator
- Supabase account with API keys

---

## Setup Instructions

### 1. Install Dependencies

```bash
cd apps/resident-app
npm install
```

### 2. Configure Supabase

1. Copy your Supabase URL and anon key
2. Update `shared/supabase/supabaseClient.js`:

```javascript
const SUPABASE_URL = "your-supabase-url";
const SUPABASE_ANON_KEY = "your-supabase-key";
```

### 3. Setup Database

Run these SQL queries in Supabase SQL Editor:

```sql
-- Create crime_reports table
CREATE TABLE crime_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES auth.users(id),
  crime_type TEXT NOT NULL,
  description TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  location_address TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'pending',
  share_live_location BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create report_feedback table
CREATE TABLE report_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES crime_reports(id),
  officer_id UUID,
  officer_name TEXT,
  response_message TEXT,
  estimated_arrival TEXT,
  action_taken TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create action_updates table
CREATE TABLE action_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES crime_reports(id),
  action_type TEXT,
  description TEXT,
  officer_id UUID,
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create announcements table
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create resident_profiles table
CREATE TABLE resident_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  address TEXT,
  city TEXT,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE crime_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE crime_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE report_feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE action_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
```

### 4. Start the Development Server

```bash
cd apps/resident-app
npm start
# or
expo start
```

### 5. Run on Device

**Android (Emulator)**:

```bash
# Press 'a' in terminal
```

**iOS (Simulator)**:

```bash
# Press 'i' in terminal
```

**Physical Device**:

- Download Expo Go app
- Scan QR code from terminal

---

## Testing the App

### Test Report Submission

1. **Tap Crime Category** (e.g., "Theft")
2. **Allow Permissions**:
   - GPS location
   - Camera access (optional)
3. **Enter Details**:
   - Description: "Test report submission"
4. **Click Submit**
5. **See Success Modal** with Reference ID

### Test My Reports

1. **Navigate to "My Reports"**
2. **See your submitted report**
3. **Tap to expand**
4. **View all details**

### Test Announcements

1. **Go to "Announcements"**
2. **See sample announcements** (if police added any)
3. **Tap to expand** and read
4. **Pull-to-refresh** to update

### Test with Sample Data

**Add test announcement**:

```sql
INSERT INTO announcements (title, content, category) VALUES
('Test Alert', 'This is a test announcement', 'alert');
```

**Simulate police feedback** (requires police backend):

```sql
INSERT INTO report_feedback (report_id, officer_name, response_message, estimated_arrival)
VALUES (
  (SELECT id FROM crime_reports LIMIT 1),
  'Officer Juan Santos',
  'We are dispatching units to your location',
  '10 minutes'
);
```

---

## Troubleshooting

### App Won't Start

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
expo start --clear
```

### Supabase Connection Error

- Check URL and key are correct
- Verify internet connection
- Ensure Supabase project is active
- Check CORS settings in Supabase dashboard

### GPS Not Working

- Ensure device has location enabled
- Grant app permission in device settings
- Try outdoor location (GPS needs clear sky)
- Check GPS is enabled in emulator settings

### Camera Not Working

- Grant camera permission
- Ensure camera is available
- Check device isn't in restricted mode

---

## Project Structure

```
resident-app/
├── app/
│   ├── (tabs)/
│   │   ├── report.tsx          - Report submission form
│   │   ├── my-reports.tsx      - Track reports & feedback
│   │   ├── announcements.tsx   - Police announcements
│   │   ├── home.tsx            - Crime categories
│   │   ├── profile.tsx         - User profile
│   │   └── ...
│   └── _layout.tsx
├── components/                 - Reusable components
├── constants/                  - App configuration
├── hooks/                      - Custom hooks
├── assets/                     - Images & icons
└── package.json

shared/
├── services/
│   ├── reportService.js        - Report API functions
│   ├── authService.js          - Authentication
│   └── ...
├── supabase/
│   └── supabaseClient.js       - Supabase config
├── models/                     - TypeScript types
└── utils/                      - Utilities
```

---

## Key Files to Understand

1. **report.tsx** - Main reporting interface (500+ lines)
2. **my-reports.tsx** - Report tracking & feedback display (600+ lines)
3. **announcements.tsx** - Announcements listing
4. **reportService.js** - All API/database functions

---

## Environment Variables

**Create `.env` file** (if not using hardcoded values):

```bash
EXPO_PUBLIC_SUPABASE_URL=your-url
EXPO_PUBLIC_SUPABASE_KEY=your-key
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

---

## API Endpoint Testing

Once police backend is built, test these endpoints:

```bash
# Send police feedback
curl -X POST http://localhost:3000/api/reports/{reportId}/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "officer_name": "Officer Santos",
    "response_message": "Units dispatched",
    "estimated_arrival": "10 minutes"
  }'

# Add action update
curl -X POST http://localhost:3000/api/reports/{reportId}/actions \
  -H "Content-Type: application/json" \
  -d '{
    "action_type": "dispatch_sent",
    "description": "Units sent to location"
  }'

# Get all reports in zone
curl http://localhost:3000/api/reports/zone/calbayog
```

---

## Commands Reference

```bash
# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Build for production
npm run build

# Run linter
npm run lint

# Run tests
npm test
```

---

## Database Backups

**Export database**:

```bash
# In Supabase dashboard:
# Settings → Backups → Download backup
```

**Import test data**:

```bash
# Use SQL editor in Supabase dashboard
# Paste INSERT statements
```

---

## Next Steps

1. ✅ **Test the resident app** (you are here)
2. 🏗️ **Build police dashboard** (see POLICE_BACKEND_SETUP.md)
3. 🔗 **Connect real police backend**
4. 📱 **Test end-to-end flow**
5. 🚀 **Deploy to App Store/Play Store**

---

## Support

**Having Issues?**

1. Check `DATABASE_SCHEMA.md` for setup requirements
2. Read `IMPLEMENTATION_GUIDE.md` for feature details
3. Review error messages in console
4. Check Supabase dashboard logs

---

## Performance Tips

- **Optimize images** before uploading
- **Use pagination** for large report lists
- **Cache announcements** client-side
- **Limit real-time subscriptions** to active reports

---

## Security Checklist

- [x] Hide Supabase credentials in `.env`
- [x] Use HTTPS for all API calls
- [x] Validate user input
- [x] Check authentication before operations
- [x] Use row-level security on database
- [x] Encrypt sensitive data

---

**Ready to run? Start with `npm install && npm start` 🚀**
