# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based Japan Study Abroad Application (日本留学考学助手) that helps students manage their application process for Japanese universities. The application supports two user roles: students and teachers, with different views and permissions for each.

## Key Features

### Dual-Role System
- **Student View**: Read-only interface for viewing timelines, schools, and material checklists
- **Teacher View**: Full editing capabilities including student management, event editing, and notes

### Core Components
- **Timeline View**: Displays upcoming exams, deadlines, and important dates with urgency indicators
- **Schools Management**: Tracks application status for multiple universities (Tokyo University, Kyoto University, Waseda University)
- **Material Checklist**: Manages required documents for applications, both general and school-specific

## Development Setup

Since this appears to be a standalone React component without package.json, to run this project you'll need to:

1. Create a new React app: `npx create-react-app japan-study-app --template typescript`
2. Replace the default App component with the japan-study-app.tsx content
3. Install required dependencies: `npm install lucide-react`
4. Run the development server: `npm start`

## Code Architecture

### State Management
- Uses React useState hooks for local state management
- Key state variables:
  - `userRole`: Controls view permissions ('student' or 'teacher')
  - `activeTab`: Navigation state for tab switching
  - `currentStudent`: Selected student data (teacher view)
  - `isEditing`: Toggle for edit mode

### Data Structure
- Mock data for students, upcoming events, and schools
- Events categorized by type: exam, deadline, contact, document
- Schools track application status: preparing, contacted, submitted, admitted

### Styling
- Uses Tailwind CSS utility classes for styling
- Responsive design optimized for mobile (max-w-md container)
- Color-coded status indicators and urgency levels

## Common Modifications

### Adding New Universities
Add entries to the `schools` array with required fields: id, name, type, program, status, deadline, examDate, tasks, teacherNotes

### Adding Event Types
1. Add new type to `getTypeColor()` function for styling
2. Add corresponding event entries to `upcomingEvents` array

### Customizing Views
- Timeline, Schools, and Checklist views are separate components within the main component
- Each view can be modified independently

### Adding New Features
- Consider adding data persistence (localStorage or backend API)
- Implement actual authentication for role switching
- Add notification system for reminders

## Important Notes

- Currently uses mock data - would need backend integration for production
- Role switching is for demonstration only - production would require proper authentication
- All text is in Chinese (Simplified) - consider i18n for multi-language support
- Mobile-first design - may need adjustments for desktop views