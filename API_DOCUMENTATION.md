# Greenroom Backend API Documentation

## Base URL

```
https://jzre02jvh9.execute-api.eu-west-2.amazonaws.com
```

All endpoints are prefixed with `/api/` and are deployed as separate AWS Lambda functions behind API Gateway.

---

## Table of Contents

- [Health Check Endpoints](#health-check-endpoints)
- [Artists](#artists)
- [Events](#events)
- [Bookings](#bookings)
- [Projects](#projects)
- [Project Tasks](#project-tasks)
- [Project Wrapups](#project-wrapups)
- [Pitches](#pitches)
- [Payments](#payments)
- [Analytics](#analytics)

---

## Health Check Endpoints

### Basic Health Check
```http
GET /api/{service}/health/
```

**Response:**
```json
{
  "status": "healthy",
  "service": "greenroom-backend",
  "timestamp": 1766754369.22
}
```

### Detailed Health Check
```http
GET /api/{service}/health/detailed/
```

**Response:**
```json
{
  "status": "healthy",
  "service": "greenroom-backend",
  "timestamp": 1766754374.79,
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful"
    },
    "cache": {
      "status": "healthy",
      "message": "Cache is working"
    },
    "application": {
      "status": "healthy",
      "debug": true,
      "version": "1.0.0"
    }
  }
}
```

**Note:** Replace `{service}` with the service name (e.g., `artists`, `events`, `bookings`, etc.)

---

## Artists

### List All Artists
```http
GET /api/artists/
```

**Query Parameters:**
- `is_active` (optional): Filter by active status (`true`/`false`)
- `is_collective_member` (optional): Filter by collective membership (`true`/`false`)

**Response:**
```json
{
  "artists": [
    {
      "id": 1,
      "artist_name": "Artist Name",
      "preferred_name": "Preferred Name",
      "is_active": true,
      "is_collective_member": true
    }
  ]
}
```

### Find Artist by Name
```http
GET /api/artists/find/?name={name}
```

**Query Parameters:**
- `name` (required): Artist name (case-insensitive search)

**Response:**
```json
{
  "id": 1,
  "artist_name": "Artist Name",
  "found": true
}
```

### Get Artist by ID
```http
GET /api/artists/{id}/
```

**Response:**
```json
{
  "artist": {
    "id": 1,
    "artist_name": "Artist Name",
    "preferred_name": "Preferred Name",
    "pronouns": "they/them",
    "bio": "Artist bio",
    "is_active": true,
    "is_collective_member": true
  },
  "genres": ["Hip Hop", "R&B"],
  "locations": [
    {
      "city": "London",
      "country": "UK"
    }
  ]
}
```

### Create Artist
```http
POST /api/artists/create/
```

**Required Fields:**
- `artist_name`

**Optional Fields:**
- `preferred_name`
- `pronouns`
- `type_of_act`
- `heritage`
- `bio`
- `primary_email`
- `primary_phone`
- `instagram`
- `soundcloud`
- `tiktok`
- `website`
- `is_collective_member`
- `is_active`
- `date_of_birth`
- `system_user_id`

**Request Body:**
```json
{
  "artist_name": "New Artist",
  "preferred_name": "Preferred Name",
  "is_active": true,
  "is_collective_member": false
}
```

**Response:**
```json
{
  "id": 1,
  "artist_name": "New Artist",
  "message": "Artist created successfully"
}
```

### Update Artist
```http
PUT /api/artists/{id}/update/
PATCH /api/artists/{id}/update/
```

**Optional Fields:**
- `artist_name`
- `preferred_name`
- `pronouns`
- `type_of_act`
- `heritage`
- `bio`
- `primary_email`
- `primary_phone`
- `instagram`
- `soundcloud`
- `tiktok`
- `website`
- `is_active`
- `is_collective_member`
- `date_of_birth`
- `updated_by_user_id`

**Request Body:**
```json
{
  "artist_name": "Updated Name",
  "bio": "Updated bio"
}
```

**Response:**
```json
{
  "message": "Artist updated successfully",
  "artist_id": 1
}
```

### Delete Artist
```http
DELETE /api/artists/{id}/delete/
```

**Response:**
```json
{
  "message": "Artist \"Artist Name\" deleted successfully"
}
```

**Error Response (if artist has bookings or project memberships):**
```json
{
  "error": "Cannot delete artist with existing bookings or project memberships",
  "bookings_count": 5,
  "project_memberships_count": 2
}
```

---

## Events

### List All Events
```http
GET /api/events/
```

**Query Parameters:**
- `start_date` (optional): Filter events from this date (format: `YYYY-MM-DD`)
- `end_date` (optional): Filter events until this date (format: `YYYY-MM-DD`)

**Response:**
```json
{
  "events": [
    {
      "id": 1,
      "name": "Event Name",
      "event_date": "2026-06-15",
      "city": "London",
      "country": "UK",
      "gig_size_id": 2,
      "gig_size_code": "M"
    }
  ]
}
```

### Get Event by ID
```http
GET /api/events/{id}/
```

**Response:**
```json
{
  "id": 1,
  "name": "Event Name",
  "event_date": "2026-06-15",
  "event_type": "Festival",
  "venue_name": "Venue Name",
  "city": "London",
  "country": "UK",
  "gig_size_id": 2,
  "gig_size_code": "M",
  "budget": "10000.00"
}
```

### Create Event
```http
POST /api/events/create/
```

**Required Fields:**
- `name`
- `event_date` (format: `YYYY-MM-DD`)
- `gig_size_id`

**Optional Fields:**
- `event_type`
- `venue`
- `venue_name`
- `city`
- `country`
- `promoter`
- `promoter_name`
- `budget`
- `source`
- `gig_size_code`
- `user_id`

**Request Body:**
```json
{
  "name": "New Event",
  "event_date": "2026-12-31",
  "gig_size_id": 2,
  "city": "London",
  "country": "UK",
  "user_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "name": "New Event",
  "message": "Event created successfully"
}
```

### Update Event
```http
PUT /api/events/{id}/update/
PATCH /api/events/{id}/update/
```

**Optional Fields:**
- `name`
- `event_date`
- `event_type`
- `venue_name`
- `venue`
- `city`
- `country`
- `promoter_name`
- `promoter`
- `budget`
- `source`
- `gig_size_id`
- `gig_size_code`
- `user_id`
- `updated_by_user_id`

**Request Body:**
```json
{
  "name": "Updated Event",
  "city": "Manchester"
}
```

**Response:**
```json
{
  "message": "Event updated successfully",
  "event_id": 1
}
```

### Delete Event
```http
DELETE /api/events/{id}/delete/
```

**Response:**
```json
{
  "message": "Event \"Event Name\" deleted successfully"
}
```

**Error Response (if event has bookings):**
```json
{
  "error": "Cannot delete event with existing bookings",
  "bookings_count": 3
}
```

---

## Bookings

### List All Bookings
```http
GET /api/bookings/
```

**Query Parameters:**
- `artist_id` (optional): Filter by artist ID
- `start_date` (optional): Filter bookings from this date (format: `YYYY-MM-DD`)
- `end_date` (optional): Filter bookings until this date (format: `YYYY-MM-DD`)

**Response:**
```json
{
  "bookings": [
    {
      "booking_id": 1,
      "artist_id": 1,
      "artist_name": "Artist Name",
      "event_id": 1,
      "event_name": "Event Name",
      "status": "confirmed",
      "agreed_fee": "5000.00"
    }
  ]
}
```

### Get Booking by ID
```http
GET /api/bookings/{id}/
```

**Response:**
```json
{
  "booking_id": 1,
  "artist": {
    "id": 1,
    "name": "Artist Name"
  },
  "event": {
    "id": 1,
    "name": "Event Name",
    "event_date": "2026-06-15"
  },
  "status": "confirmed",
  "agreed_fee": "5000.00"
}
```

### Create Booking
```http
POST /api/bookings/create/
```

**Required Fields:**
- `artist_id`
- `event_id`

**Optional Fields:**
- `status`
- `agreed_fee`
- `notes`
- `user_id`

**Request Body:**
```json
{
  "artist_id": 1,
  "event_id": 1,
  "status": "pending",
  "agreed_fee": 5000.00,
  "user_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "artist_name": "Artist Name",
  "event_name": "Event Name",
  "message": "Booking created successfully"
}
```

### Update Booking
```http
PUT /api/bookings/{id}/update/
PATCH /api/bookings/{id}/update/
```

**Optional Fields:**
- `artist_id`
- `event_id`
- `status`
- `agreed_fee`
- `notes`
- `user_id`
- `updated_by_user_id`

**Request Body:**
```json
{
  "status": "confirmed",
  "agreed_fee": 6000.00
}
```

**Response:**
```json
{
  "message": "Booking updated successfully",
  "booking_id": 1
}
```

### Delete Booking
```http
DELETE /api/bookings/{id}/delete/
```

**Response:**
```json
{
  "message": "Booking 1 deleted successfully"
}
```

**Error Response (if booking has payments):**
```json
{
  "error": "Cannot delete booking with existing payments",
  "payments_count": 2
}
```

---

## Projects

### List All Projects
```http
GET /api/projects/
```

**Query Parameters:**
- `status` (optional): Filter by status (default: `active`)

**Response:**
```json
{
  "projects": [
    {
      "id": 1,
      "name": "Project Name",
      "status": "active",
      "project_type": "Album",
      "lead_artist_id": 1
    }
  ]
}
```

### Get Project by ID
```http
GET /api/projects/{id}/
```

**Response:**
```json
{
  "project": {
    "id": 1,
    "name": "Project Name",
    "description": "Project description",
    "status": "active",
    "members": [
      {
        "artist_id": 1,
        "artist_name": "Artist",
        "role_in_project": "Producer"
      }
    ],
    "tasks": [
      {
        "id": 1,
        "title": "Task",
        "status": "todo"
      }
    ],
    "wrapup": {
      "summary": "Project summary"
    }
  }
}
```

### Create Project
```http
POST /api/projects/create/
```

**Required Fields:**
- `name`
- `status`

**Optional Fields:**
- `description`
- `project_type`
- `start_date` (format: `YYYY-MM-DD`)
- `end_date` (format: `YYYY-MM-DD`)
- `lead_artist_id`
- `budget`
- `drive_parent_folder_id`
- `updated_by_user_id`

**Request Body:**
```json
{
  "name": "New Project",
  "status": "active",
  "description": "Project description",
  "lead_artist_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "name": "New Project",
  "status": "active",
  "message": "Project created successfully"
}
```

### Update Project
```http
PUT /api/projects/{id}/update/
PATCH /api/projects/{id}/update/
```

**Optional Fields:**
- `name`
- `description`
- `status`
- `project_type`
- `start_date`
- `end_date`
- `lead_artist_id`
- `budget`
- `drive_parent_folder_id`
- `updated_by_user_id`

**Request Body:**
```json
{
  "name": "Updated Project",
  "status": "completed"
}
```

**Response:**
```json
{
  "message": "Project updated successfully",
  "project_id": 1
}
```

### Delete Project
```http
DELETE /api/projects/{id}/delete/
```

**Response:**
```json
{
  "message": "Project \"Project Name\" deleted successfully"
}
```

**Error Response (if project has dependencies):**
```json
{
  "error": "Cannot delete project with existing members, tasks, wrapups, files, payments, or pitches",
  "members_count": 5,
  "tasks_count": 10
}
```

### Assign Team to Project
```http
POST /api/projects/{id}/assign-team/
```

**Required Fields:**
- `team_members` (array of objects)

**Request Body:**
```json
{
  "team_members": [
    {
      "artist_id": 1,
      "role_in_project": "Producer"
    },
    {
      "artist_id": 2,
      "role_in_project": "Engineer"
    }
  ]
}
```

**Response:**
```json
{
  "message": "2 team members assigned",
  "members": [
    {
      "artist_id": 1,
      "artist_name": "Artist",
      "role": "Producer"
    }
  ]
}
```

### Update Project Status
```http
PATCH /api/projects/{id}/update-status/
```

**Optional Fields:**
- `status`
- `description`
- `end_date`
- `updated_by_user_id`

**Request Body:**
```json
{
  "status": "completed",
  "end_date": "2026-12-31"
}
```

**Response:**
```json
{
  "message": "Project updated successfully",
  "project_id": 1,
  "status": "completed"
}
```

### Archive Project
```http
POST /api/projects/{id}/archive/
```

**Response:**
```json
{
  "message": "Project archived successfully",
  "project_id": 1
}
```

### Get Artist Projects
```http
GET /api/artists/{id}/projects/
```

**Response:**
```json
{
  "artist_id": 1,
  "artist_name": "Artist Name",
  "projects": [
    {
      "project_id": 1,
      "project_name": "Project",
      "status": "active",
      "role_in_project": "Producer"
    }
  ]
}
```

---

## Project Tasks

### List Project Tasks
```http
GET /api/projects/{id}/tasks/
```

**Response:**
```json
{
  "project_id": 1,
  "tasks_by_status": {
    "todo": [
      {
        "id": 1,
        "title": "Task",
        "status": "todo",
        "priority": "high"
      }
    ],
    "in_progress": [
      {
        "id": 2,
        "title": "Task 2",
        "status": "in_progress"
      }
    ]
  }
}
```

### Create Project Task
```http
POST /api/projects/{id}/tasks/create/
```

**Required Fields:**
- `title`

**Optional Fields:**
- `description`
- `status`
- `priority`
- `assignee_user_id`
- `due_date` (format: `YYYY-MM-DD`)
- `updated_by_user_id`

**Request Body:**
```json
{
  "title": "New Task",
  "description": "Task description",
  "status": "todo",
  "priority": "high",
  "assignee_user_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "title": "New Task",
  "message": "Task created successfully"
}
```

### Update Task
```http
PUT /api/tasks/{id}/update/
PATCH /api/tasks/{id}/update/
```

**Optional Fields:**
- `title`
- `description`
- `status`
- `priority`
- `assignee_user_id`
- `due_date`
- `updated_by_user_id`

**Request Body:**
```json
{
  "status": "completed",
  "priority": "low"
}
```

**Response:**
```json
{
  "message": "Task updated successfully",
  "task_id": 1,
  "status": "completed"
}
```

### Delete Task
```http
DELETE /api/tasks/{id}/delete/
```

**Response:**
```json
{
  "message": "Task \"Task Name\" deleted successfully"
}
```

---

## Project Wrapups

### Get Project Wrapup
```http
GET /api/projects/{id}/wrapup/
```

**Response:**
```json
{
  "project_id": 1,
  "wrapup": {
    "id": 1,
    "summary": "Project summary",
    "lessons_learned": "Lessons learned",
    "submitted_by": "username",
    "date_created": "2026-01-01T00:00:00Z"
  }
}
```

### Create Project Wrapup
```http
POST /api/projects/{id}/wrapup/create/
```

**Optional Fields:**
- `summary`
- `lessons_learned`
- `wrapup_by_user_id`
- `updated_by_user_id`

**Request Body:**
```json
{
  "summary": "Project completed successfully",
  "lessons_learned": "Teamwork is key",
  "wrapup_by_user_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "message": "Wrapup created successfully"
}
```

### Update Project Wrapup
```http
PUT /api/projects/{id}/wrapup/update/
PATCH /api/projects/{id}/wrapup/update/
```

**Optional Fields:**
- `summary`
- `lessons_learned`
- `wrapup_by_user_id`
- `updated_by_user_id`

**Request Body:**
```json
{
  "summary": "Updated summary",
  "lessons_learned": "Updated lessons"
}
```

**Response:**
```json
{
  "message": "Wrapup updated successfully",
  "wrapup_id": 1
}
```

### Delete Project Wrapup
```http
DELETE /api/projects/{id}/wrapup/delete/
```

**Response:**
```json
{
  "message": "Wrapup 1 deleted successfully"
}
```

---

## Pitches

### List All Pitches
```http
GET /api/pitches/
```

**Response:**
```json
{
  "pitches": [
    {
      "id": 1,
      "title": "Pitch Title",
      "status": "submitted",
      "total_votes": 5,
      "yes_votes": 3
    }
  ]
}
```

### Get Pitch by ID
```http
GET /api/pitches/{id}/
```

**Response:**
```json
{
  "pitch": {
    "id": 1,
    "title": "Pitch Title",
    "description": "Pitch description",
    "status": "submitted"
  },
  "votes": [
    {
      "user_id": 1,
      "username": "user",
      "vote_value": 1,
      "comment": "Great idea"
    }
  ],
  "comments": [
    {
      "id": 1,
      "user_id": 1,
      "username": "user",
      "comment": "Comment text"
    }
  ]
}
```

### Create Pitch
```http
POST /api/pitches/create/
```

**Required Fields:**
- `submitter_user_id`
- `title`

**Optional Fields:**
- `description`
- `status`
- `project_id`

**Request Body:**
```json
{
  "title": "New Pitch",
  "description": "Pitch description",
  "status": "submitted",
  "submitter_user_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "title": "New Pitch",
  "status": "submitted",
  "message": "Pitch created successfully"
}
```

### Update Pitch
```http
PUT /api/pitches/{id}/update/
PATCH /api/pitches/{id}/update/
```

**Optional Fields:**
- `title`
- `description`
- `status`
- `submitter_user_id`
- `project_id`
- `updated_by_user_id`

**Request Body:**
```json
{
  "title": "Updated Pitch",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "message": "Pitch updated successfully",
  "pitch_id": 1
}
```

### Delete Pitch
```http
DELETE /api/pitches/{id}/delete/
```

**Response:**
```json
{
  "message": "Pitch \"Pitch Title\" deleted successfully"
}
```

**Error Response (if pitch has votes or comments):**
```json
{
  "error": "Cannot delete pitch with existing votes or comments",
  "votes_count": 5,
  "comments_count": 3
}
```

### Vote on Pitch
```http
POST /api/pitches/{id}/vote/
```

**Required Fields:**
- `user_id`
- `vote_value` (typically `1` for yes, `-1` for no)

**Optional Fields:**
- `comment`

**Request Body:**
```json
{
  "user_id": 1,
  "vote_value": 1,
  "comment": "Great idea!"
}
```

**Response:**
```json
{
  "message": "Vote recorded successfully",
  "vote_id": 1,
  "vote_value": 1
}
```

### Move Pitch to Project
```http
POST /api/pitches/{id}/move-to-project/
```

**Required Fields:**
- `project_id`

**Request Body:**
```json
{
  "project_id": 1
}
```

**Response:**
```json
{
  "message": "Pitch moved to project successfully",
  "pitch_id": 1,
  "project_id": 1
}
```

### Close Pitch
```http
POST /api/pitches/{id}/close/
```

**Optional Fields:**
- `status` (default: `closed`)

**Request Body:**
```json
{
  "status": "closed"
}
```

**Response:**
```json
{
  "message": "Pitch closed successfully",
  "pitch_id": 1,
  "status": "closed"
}
```

### Add Pitch Comment
```http
POST /api/pitches/{id}/comments/
```

**Required Fields:**
- `user_id`
- `comment`

**Optional Fields:**
- `parent_comment_id` (for nested comments)

**Request Body:**
```json
{
  "user_id": 1,
  "comment": "This is a comment",
  "parent_comment_id": null
}
```

**Response:**
```json
{
  "message": "Comment added successfully",
  "comment_id": 1
}
```

---

## Payments

### List All Payments
```http
GET /api/payments/
```

**Query Parameters:**
- `artist_id` (optional): Filter by artist ID
- `project_id` (optional): Filter by project ID

**Response:**
```json
{
  "payments": [
    {
      "id": 1,
      "artist_id": 1,
      "artist_name": "Artist Name",
      "amount": "5000.00",
      "currency": "GBP",
      "status": "pending"
    }
  ]
}
```

### Get Payment by ID
```http
GET /api/payments/{id}/
```

**Response:**
```json
{
  "id": 1,
  "artist": {
    "id": 1,
    "name": "Artist Name"
  },
  "amount": "5000.00",
  "currency": "GBP",
  "status": "pending",
  "invoice_number": "INV-001"
}
```

### Create Payment
```http
POST /api/payments/create/
```

**Required Fields:**
- `artist_id`
- `amount`
- `status`

**Optional Fields:**
- `booking_id`
- `project_id`
- `currency`
- `invoice_number`
- `issue_date` (format: `YYYY-MM-DD`)
- `due_date` (format: `YYYY-MM-DD`)
- `paid_date` (format: `YYYY-MM-DD`)
- `notes`
- `updated_by_user_id`

**Request Body:**
```json
{
  "artist_id": 1,
  "amount": "5000.00",
  "currency": "GBP",
  "status": "pending",
  "invoice_number": "INV-001"
}
```

**Response:**
```json
{
  "id": 1,
  "message": "Payment created successfully"
}
```

### Update Payment
```http
PUT /api/payments/{id}/update/
PATCH /api/payments/{id}/update/
```

**Optional Fields:**
- `artist_id`
- `booking_id`
- `project_id`
- `amount`
- `currency`
- `status`
- `invoice_number`
- `issue_date`
- `due_date`
- `paid_date`
- `notes`
- `updated_by_user_id`

**Request Body:**
```json
{
  "status": "paid",
  "paid_date": "2026-01-15"
}
```

**Response:**
```json
{
  "message": "Payment updated successfully",
  "payment_id": 1
}
```

### Delete Payment
```http
DELETE /api/payments/{id}/delete/
```

**Response:**
```json
{
  "message": "Payment 1 deleted successfully"
}
```

---

## Analytics

### Get Gig Scores by Artist
```http
GET /api/analytics/gig-scores/
```

**Response:**
```json
{
  "gig_scores": [
    {
      "artist_id": 1,
      "artist_name": "Artist Name",
      "total_gig_score": 15,
      "gig_count": 5
    }
  ]
}
```

### Get Artists by Country
```http
GET /api/analytics/artists-by-country/?country={country}
```

**Query Parameters:**
- `country` (required): Country name

**Response:**
```json
{
  "country": "UK",
  "artists": [
    {
      "id": 1,
      "artist_name": "Artist Name"
    }
  ]
}
```

### Get Artists in Multiple Cities
```http
GET /api/analytics/artists-multiple-cities/?country={country}
```

**Query Parameters:**
- `country` (required): Country name

**Response:**
```json
{
  "country": "UK",
  "artists": [
    {
      "artist_id": 1,
      "artist_name": "Artist",
      "cities_played": 3
    }
  ]
}
```

---

## Error Responses

All endpoints may return standard HTTP error codes:

- `400 Bad Request`: Invalid request data
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

**Error Response Format:**
```json
{
  "error": "Error message",
  "details": "Additional error details (if available)"
}
```

---

## Notes

1. **Date Formats**: All dates should be in `YYYY-MM-DD` format
2. **Authentication**: Currently, the API does not require authentication. This may change in the future.
3. **CORS**: CORS is enabled for all origins (`*`)
4. **Content-Type**: Use `application/json` for request bodies
5. **Service-Specific Endpoints**: Each service (artists, events, bookings, etc.) is deployed as a separate Lambda function. Health check endpoints are available for each service at `/api/{service}/health/`

---

## Service Deployment

The API is deployed as separate AWS Lambda functions:
- `prod-artists-service`
- `prod-events-service`
- `prod-bookings-service`
- `prod-projects-service`
- `prod-tasks-service`
- `prod-pitches-service`
- `prod-payments-service`
- `prod-analytics-service`
- `prod-users-service`

All services are accessible through the same API Gateway endpoint.

