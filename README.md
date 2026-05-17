# Ligtas Calbayog

**Ligtas Calbayog** is a comprehensive, multi-platform ecosystem designed to enhance community safety, emergency response, public health advocacy, and civic engagement for the citizens of Calbayog City. 

The project connects residents, local authorities (like the police), and administration through dedicated applications to streamline communication, incident reporting, and public health initiatives (such as Dengue awareness and community clean-up drives).

## 📱 Project Ecosystem

The platform is structured as a monorepo containing multiple interconnected applications and shared services:

### 1. Resident App (`apps/resident-app`)
A mobile application built with React Native/Expo for the citizens of Calbayog.
*   **Secure Registration**: Features a robust registration flow with mandatory **Liveness Verification** (facial motion detection) to ensure the authenticity of user profiles.
*   **Civic Engagement**: Allows users to register as volunteers for community clean-up drives and public health initiatives.
*   **Modern UI**: Professional, dark-themed, and animated user interface for a premium user experience.

### 2. Police App (`apps/police-app`)
A dedicated mobile application for law enforcement and emergency responders to manage incidents, verify profiles, and respond to community alerts.

### 3. Admin Web Dashboard (`apps/admin-web`)
A web-based portal for administrators to manage the platform.
*   **Content Management**: Dynamically post, update, and manage upcoming community clean-up drives.
*   **Dengue Advocacy Platform**: Integrates live epidemiological data (e.g., from DOH datasets via HDX) to display real-time dengue case statistics and trends.
*   **Volunteer Management**: Track and manage volunteer registrations.

### 4. Shared Services (`shared/`)
Contains shared business logic, models, utilities, and backend configuration that are used across all applications.

## 🛠️ Technology Stack

*   **Frontend (Mobile)**: React Native, Expo
*   **Frontend (Web)**: Web technologies for the admin dashboard
*   **Backend & Database**: **Supabase** (Migrated from Firebase)
    *   **PostgreSQL**: Relational database managing `users`, `resident_profiles`, and `police_profiles`.
    *   **Row-Level Security (RLS)**: Enforces strict data access policies.
    *   **Authentication**: Secure user authentication.
    *   **Storage**: Public buckets used for storing Liveness Verification photos and other assets.

## 🚀 Development Roadmap & Current Focus

*   [x] **Backend Migration**: Successfully migrated from Firebase to Supabase for all Auth, Database, and Storage needs.
*   [x] **Liveness Verification Gate**: Implemented a mandatory facial-movement liveness check before users can successfully register on the Resident App.
*   [x] **UI/UX Modernization**: Revamped the Resident App login and registration flows with dynamic gradients, scrollable content, and premium animations.
*   [ ] **Dengue Advocacy Integration**: Connecting the web dashboard to live public health APIs for dynamic data visualization.
*   [ ] **Volunteer Module Polish**: Finalizing the data pipeline between the mobile app volunteer registrations and the web admin dashboard.

## 💻 Getting Started

This repository uses a monorepo structure. Ensure you have Node.js and standard React Native/Expo development tools installed.

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Run the Resident App**:
    ```bash
    cd apps/resident-app
    npm start
    ```
3.  **Environment Variables**:
    Ensure you have configured your `.env` files with the correct **Supabase URL** and **Anon Key**. (See `shared/supabase/supabaseClient.js`).

---
*Built for the safety, health, and empowerment of Calbayog City.*
