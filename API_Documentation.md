# Wheelio API Documentation

**Wheelio** is a full-stack vehicle rental marketplace. This document describes the complete REST API implemented by the Express.js + TypeScript backend.

- **Base URL (local):** `http://localhost:5000/api`
- **Base URL (production):** `https://[YOUR_DEPLOYED_BACKEND_URL]/api` — no production URL is committed in the repository; set this when you deploy.
- **Health check:** `GET http://localhost:5000/health` (outside the `/api` prefix)

> All endpoints are documented as actually implemented in the codebase. Nothing here is assumed or invented.

---

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Auth](#auth)
- [Categories](#categories)
- [Vehicles](#vehicles)
- [Reviews](#reviews)
- [Wishlist](#wishlist)
- [Users](#users)
- [Bookings](#bookings)
- [Payments](#payments)
- [Dashboard](#dashboard)
- [Enums](#enums)
- [Database Models Overview](#database-models-overview)

---

## Authentication

### Getting a token

| Method | Endpoint | What it does |
|--------|----------|--------------|
| `POST` | `/api/auth/register` | Create an account (returns a user object; **no** token) |
| `POST` | `/api/auth/login` | Log in with email + password (returns `token` + sets an `httpOnly` cookie) |
| `POST` | `/api/auth/google-login` | Log in / sign up with a Google credential (returns `token` + sets an `httpOnly` cookie) |

`login` and `google-login` return the JWT in the response body (`data.token`) **and** set an `httpOnly` cookie named `token` (7-day expiry, `secure` in production).

### Sending the token

Any protected endpoint accepts the JWT in one of two ways:

1. **Authorization header (recommended for programmatic use):**

   ```
   Authorization: Bearer <token>
   ```

2. **Cookie:** the `token` cookie set by login/google-login is read automatically when no header is present.

The middleware (`src/middlewares/auth.middleware.ts`) checks the `Authorization` header first, then falls back to the `token` cookie.

### Token contents & expiry

The JWT is signed with `JWT_SECRET` and expires after `JWT_EXPIRES_IN` (default `7d`). Payload:

```json
{
  "userId": "...",
  "role": "CUSTOMER",
  "email": "user@example.com"
}
```

### Roles

`authorizeRoles(...)` enforces role access. Roles: `CUSTOMER`, `VENDOR`, `ADMIN`.

- Missing/invalid token → `401`
- Valid token but role not allowed → `403`

---

## Response Format

### Success

Every successful controller response uses a consistent envelope (`src/utils/sendResponse.ts`):

```json
{
  "success": true,
  "message": "Operational message",
  "data": {}
}
```

Paginated list endpoints additionally include a `meta` object:

```json
{
  "success": true,
  "message": "Vehicles retrieved successfully",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42
  }
}
```

### Error

Every error passes through the global error middleware (`src/middlewares/error.middleware.ts`):

```json
{
  "success": false,
  "message": "Human-readable error message",
  "data": null,
  "statusCode": 404
}
```

For Zod validation failures an extra `errors` array is included:

```json
{
  "success": false,
  "message": "Validation error.",
  "data": null,
  "statusCode": 400,
  "errors": [
    { "path": ["password"], "message": "Password must be at least 6 characters" }
  ]
}
```

### Common status codes

| Code | Meaning |
|------|---------|
| `200` | OK |
| `201` | Created |
| `400` | Validation error or business-rule violation (e.g. dates, availability) |
| `401` | Not authenticated / invalid credentials |
| `403` | Authenticated but wrong role, or not the resource owner |
| `404` | Resource not found |
| `409` | Conflict / duplicate (e.g. duplicate email, already booked dates) |
| `500` | Server error (or missing config, e.g. Stripe/Google not configured) |
| `502` | Payment provider (Stripe) refund failed |

---

## Auth

### POST /api/auth/register

**Description:** Create a new account. Returns the created user **without** a token (the client is expected to log in next).

**Auth required:** No

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "phone": "+8801700000000",
  "role": "CUSTOMER"
}
```

- `role` is optional; allowed values `CUSTOMER` | `VENDOR` (defaults to `CUSTOMER`). `ADMIN` is **not** allowed via registration.
- `phone` is optional.

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `201`

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+8801700000000",
      "profileImage": null,
      "role": "CUSTOMER",
      "authProvider": "credentials",
      "hasPassword": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses:**

- `400` — Validation error (invalid fields)
- `409` — An account with this email already exists

---

### POST /api/auth/login

**Description:** Log in with email and password. Returns a JWT and sets the `token` cookie.

**Auth required:** No

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com", "role": "CUSTOMER", "authProvider": "credentials", "hasPassword": true },
    "token": "<jwt>"
  }
}
```

**Error Responses:**

- `400` — Validation error
- `401` — Invalid email or password; or the account is a Google-only account with no password set
- `403` — Your account has been blocked

---

### POST /api/auth/google-login

**Description:** Verify a Google ID token and log in (or create) the matching user. Returns a JWT and sets the `token` cookie.

**Auth required:** No

**Request Body:**

```json
{
  "credential": "<google_id_token>"
}
```

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Google login successful",
  "data": {
    "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com", "role": "CUSTOMER", "authProvider": "google", "hasPassword": false },
    "token": "<jwt>"
  }
}
```

**Error Responses:**

- `400` — Validation error; or Google email is not verified
- `401` — Invalid or expired Google token; or the account is no longer active
- `403` — Your account has been blocked
- `500` — Google authentication is not configured (missing `GOOGLE_CLIENT_ID`)

---

### POST /api/auth/logout

**Description:** Clear the `token` cookie.

**Auth required:** No

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{ "success": true, "message": "Logged out successfully", "data": null }
```

**Error Responses:** None expected

---

### GET /api/auth/me

**Description:** Return the currently authenticated user's profile (password never exposed; `hasPassword` indicates whether a password is set).

**Auth required:** Yes (any role)

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": null,
      "profileImage": null,
      "password": null,
      "role": "CUSTOMER",
      "authProvider": "credentials",
      "isBlocked": false,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "hasPassword": true
    }
  }
}
```

**Error Responses:**

- `401` — Not authenticated
- `404` — User not found

---

### POST /api/auth/change-password

**Description:** Change the current user's password (requires the current password).

**Auth required:** Yes (any role)

**Request Body:**

```json
{
  "currentPassword": "old-secret",
  "newPassword": "new-secret"
}
```

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{ "success": true, "message": "Password updated successfully", "data": null }
```

**Error Responses:**

- `400` — Validation error; account has no password set; current password is incorrect
- `401` — Not authenticated
- `404` — User not found

---

### POST /api/auth/set-password

**Description:** Set a password for the current user (used for Google-only accounts that have no password).

**Auth required:** Yes (any role)

**Request Body:**

```json
{
  "newPassword": "secret123"
}
```

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{ "success": true, "message": "Password set successfully", "data": null }
```

**Error Responses:**

- `400` — Validation error; a password is already set (use change-password instead)
- `401` — Not authenticated
- `404` — User not found

---

## Categories

### POST /api/categories

**Description:** Create a new vehicle category.

**Auth required:** Yes — **ADMIN** only

**Request Body:**

```json
{
  "name": "Sedan",
  "description": "Comfortable four-door cars",
  "icon": "🚗"
}
```

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `201`

```json
{
  "success": true,
  "message": "Category created successfully",
  "data": { "id": "uuid", "name": "Sedan", "description": "Comfortable four-door cars", "icon": "🚗", "isDeleted": false, "createdAt": "...", "updatedAt": "..." }
}
```

**Error Responses:**

- `400` — Validation error
- `401` — Not authenticated
- `403` — Requires ADMIN role
- `409` — A category with this name already exists

---

### GET /api/categories

**Description:** List all categories (non-deleted).

**Auth required:** No

**Request Body:** None

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `page` | number (optional) | Page number (default `1`) |
| `limit` | number (optional) | Page size (default `20`) |

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    { "id": "uuid", "name": "Sedan", "description": "Comfortable four-door cars", "icon": "🚗", "isDeleted": false, "createdAt": "...", "updatedAt": "...", "_count": { "vehicles": 12 } }
  ],
  "meta": { "page": 1, "limit": 20, "total": 6 }
}
```

**Error Responses:** None expected

---

### GET /api/categories/:id

**Description:** Get a single category including its (non-deleted) vehicles.

**Auth required:** No

**Request Body:** None

**Query Parameters:** None

**URL Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Category UUID |

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Category retrieved successfully",
  "data": { "id": "uuid", "name": "Sedan", "description": "...", "icon": "🚗", "isDeleted": false, "vehicles": [] }
}
```

**Error Responses:**

- `404` — Category not found

---

### PATCH /api/categories/:id

**Description:** Update a category.

**Auth required:** Yes — **ADMIN** only

**Request Body:**

```json
{ "name": "Sedan (Updated)", "description": "New description", "icon": "🚗" }
```

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": { "id": "uuid", "name": "Sedan (Updated)", "description": "New description", "icon": "🚗" }
}
```

**Error Responses:**

- `400` — Validation error
- `401` — Not authenticated
- `403` — Requires ADMIN role
- `404` — Category not found
- `409` — Duplicate name

---

### DELETE /api/categories/:id

**Description:** Soft-delete a category (`isDeleted = true`). Cannot delete a category that still has vehicles.

**Auth required:** Yes — **ADMIN** only

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Category deleted successfully",
  "data": { "id": "uuid", "name": "Sedan", "isDeleted": true }
}
```

**Error Responses:**

- `400` — Cannot delete a category that still has vehicles
- `401` — Not authenticated
- `403` — Requires ADMIN role
- `404` — Category not found

---

## Vehicles

### GET /api/vehicles

**Description:** List vehicles with optional filtering, pagination and sorting. Each vehicle includes its category and computed `averageRating` / `reviewCount`.

**Auth required:** No

**Request Body:** None

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `page` | number (optional) | Page number (default `1`) |
| `limit` | number (optional) | Page size (default `10`) |
| `categoryId` | string (optional) | Filter by category |
| `minPrice` | number (optional) | Minimum price per day |
| `maxPrice` | number (optional) | Maximum price per day |
| `status` | string (optional) | `AVAILABLE` / `BOOKED` / `MAINTENANCE` / `INACTIVE` |
| `search` | string (optional) | Case-insensitive match on name/brand/model |
| `sort` | string (optional) | `price_asc` / `price_desc` / `newest` (default `newest`) |

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Vehicles retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "name": "Toyota Camry",
      "brand": "Toyota",
      "model": "Camry",
      "images": ["https://.../img.jpg"],
      "pricePerDay": "60.00",
      "description": "...",
      "status": "AVAILABLE",
      "location": "Dhaka",
      "vendorId": "uuid",
      "categoryId": "uuid",
      "isDeleted": false,
      "createdAt": "...",
      "updatedAt": "...",
      "category": { "id": "uuid", "name": "Sedan", "description": "...", "icon": "🚗", "isDeleted": false, "createdAt": "...", "updatedAt": "..." },
      "averageRating": 4.5,
      "reviewCount": 8
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 42 }
}
```

**Error Responses:**

- `400` — Invalid query parameter values

---

### GET /api/vehicles/my-vehicles

**Description:** List the authenticated vendor's own vehicles, each with its category, booking count, rating and review count.

**Auth required:** Yes — **VENDOR** only

**Request Body:** None

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `page` | number (optional) | Page number (default `1`) |
| `limit` | number (optional) | Page size (default `10`) |

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Your vehicles retrieved successfully",
  "data": [
    { "id": "uuid", "name": "Toyota Camry", "status": "AVAILABLE", "pricePerDay": "60.00", "category": { "id": "uuid", "name": "Sedan" }, "_count": { "bookings": 3 }, "averageRating": 4.5, "reviewCount": 8 }
  ],
  "meta": { "page": 1, "limit": 10, "total": 5 }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Requires VENDOR role

---

### POST /api/vehicles

**Description:** Create a vehicle listing owned by the authenticated vendor.

**Auth required:** Yes — **VENDOR** only

**Request Body:**

```json
{
  "categoryId": "uuid",
  "name": "Toyota Land Cruiser",
  "brand": "Toyota",
  "model": "Land Cruiser",
  "images": ["https://.../img1.jpg", "https://.../img2.jpg"],
  "pricePerDay": 150,
  "description": "A rugged 4x4 ready for any terrain.",
  "status": "AVAILABLE",
  "location": "Dhaka"
}
```

- `status` is optional (defaults to `AVAILABLE`); `location` is optional.
- `images` must contain at least one valid URL; `pricePerDay` must be positive; `description` at least 10 characters; `name` at least 3 characters.

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `201`

```json
{
  "success": true,
  "message": "Vehicle created successfully",
  "data": {
    "id": "uuid",
    "name": "Toyota Land Cruiser",
    "brand": "Toyota",
    "model": "Land Cruiser",
    "images": ["https://.../img1.jpg"],
    "pricePerDay": "150.00",
    "description": "...",
    "status": "AVAILABLE",
    "location": "Dhaka",
    "vendorId": "uuid",
    "categoryId": "uuid",
    "category": { "id": "uuid", "name": "SUV" }
  }
}
```

**Error Responses:**

- `400` — Validation error
- `401` — Not authenticated
- `403` — Requires VENDOR role
- `404` — Category not found

---

### GET /api/vehicles/:id

**Description:** Get a single vehicle with its category, vendor info, reviews (public shape) and computed rating.

**Auth required:** No

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Vehicle retrieved successfully",
  "data": {
    "id": "uuid",
    "name": "Toyota Camry",
    "brand": "Toyota",
    "model": "Camry",
    "images": ["https://.../img.jpg"],
    "pricePerDay": "60.00",
    "description": "...",
    "status": "AVAILABLE",
    "location": "Dhaka",
    "category": { "id": "uuid", "name": "Sedan" },
    "vendor": { "id": "uuid", "profileImage": null, "role": "VENDOR", "authProvider": "credentials", "isBlocked": false, "createdAt": "...", "updatedAt": "..." },
    "reviews": [
      { "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "rating": 5, "comment": "Great car!", "isDeleted": false, "createdAt": "...", "updatedAt": "...", "user": { "id": "uuid", "name": "John", "profileImage": null } }
    ],
    "averageRating": 5,
    "reviewCount": 1
  }
}
```

**Error Responses:**

- `404` — Vehicle not found

---

### PATCH /api/vehicles/:id

**Description:** Update a vehicle. Vendors can only update their own vehicles; ADMIN can update any.

**Auth required:** Yes — **VENDOR** or **ADMIN**

**Request Body:** Any subset of the create fields (partial update):

```json
{ "pricePerDay": 180, "status": "MAINTENANCE" }
```

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Vehicle updated successfully",
  "data": { "id": "uuid", "pricePerDay": "180.00", "status": "MAINTENANCE" }
}
```

**Error Responses:**

- `400` — Validation error
- `401` — Not authenticated
- `403` — Requires VENDOR/ADMIN role, or not the vehicle owner
- `404` — Vehicle not found

---

### DELETE /api/vehicles/:id

**Description:** Soft-delete a vehicle. Blocked while the vehicle has active (PENDING/CONFIRMED) bookings. Vendors can only delete their own vehicles; ADMIN can delete any.

**Auth required:** Yes — **VENDOR** or **ADMIN**

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Vehicle deleted successfully",
  "data": { "id": "uuid", "name": "Toyota Camry", "isDeleted": true }
}
```

**Error Responses:**

- `400` — Cannot delete a vehicle with active bookings
- `401` — Not authenticated
- `403` — Requires VENDOR/ADMIN role, or not the vehicle owner
- `404` — Vehicle not found

---

## Reviews

### GET /api/reviews/vehicle/:vehicleId

**Description:** List reviews for a vehicle (public). Optionally enriched with the caller's own reaction if a valid token is sent (optional auth).

**Auth required:** No (optional auth — include a token to get `myReaction`)

**Request Body:** None

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `page` | number (optional) | Page number (default `1`) |
| `limit` | number (optional) | Page size (default `10`) |

**URL Parameters:** `vehicleId` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "vehicleId": "uuid",
      "rating": 5,
      "comment": "Great car!",
      "isDeleted": false,
      "createdAt": "...",
      "updatedAt": "...",
      "user": { "id": "uuid", "name": "John", "profileImage": null },
      "reply": { "id": "uuid", "reviewId": "uuid", "vendorId": "uuid", "content": "Thank you!", "createdAt": "...", "updatedAt": "...", "vendor": { "id": "uuid", "name": "Vendor One" } },
      "likeCount": 3,
      "dislikeCount": 1,
      "myReaction": { "id": "uuid", "type": "LIKE" }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 4, "averageRating": 4.5 }
}
```

**Error Responses:** None expected

---

### GET /api/reviews

**Description:** List all reviews (admin moderation view). Includes full reaction list.

**Auth required:** Yes — **ADMIN** only

**Request Body:** None

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `page` | number (optional) | Page number (default `1`) |
| `limit` | number (optional) | Page size, max 100 (default `10`) |

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": [
    {
      "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "rating": 5, "comment": "Great car!",
      "user": { "id": "uuid", "name": "John", "profileImage": null },
      "vehicle": { "id": "uuid", "name": "Toyota Camry" },
      "reply": null,
      "reactions": [{ "id": "uuid", "type": "LIKE", "userId": "uuid", "user": { "id": "uuid", "name": "Jane" } }],
      "likeCount": 3,
      "dislikeCount": 1
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 40 }
}
```

**Error Responses:**

- `400` — Invalid query parameter values
- `401` — Not authenticated
- `403` — Requires ADMIN role

---

### GET /api/reviews/:id

**Description:** Get a single review (admin moderation view).

**Auth required:** Yes — **ADMIN** only

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Review retrieved successfully",
  "data": { "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "rating": 5, "comment": "Great car!", "likeCount": 3, "dislikeCount": 1 }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Requires ADMIN role
- `404` — Review not found

---

### POST /api/reviews

**Description:** Submit a review for a vehicle. One review per user per vehicle.

**Auth required:** Yes — **CUSTOMER** only

**Request Body:**

```json
{
  "vehicleId": "uuid",
  "rating": 5,
  "comment": "Great car, highly recommend!"
}
```

- `rating` is an integer 1–5; `comment` is optional.

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `201`

```json
{
  "success": true,
  "message": "Review submitted successfully",
  "data": {
    "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "rating": 5, "comment": "Great car, highly recommend!",
    "user": { "id": "uuid", "name": "John", "profileImage": null },
    "reply": null,
    "likeCount": 0,
    "dislikeCount": 0,
    "myReaction": null
  }
}
```

**Error Responses:**

- `400` — Validation error; or you cannot review your own vehicle
- `401` — Not authenticated
- `403` — Requires CUSTOMER role
- `404` — Vehicle not found
- `409` — You have already reviewed this vehicle

---

### PATCH /api/reviews/:id

**Description:** Update the rating/comment of a review. Owners can update their own; ADMIN can update any.

**Auth required:** Yes (owner or ADMIN)

**Request Body:**

```json
{ "rating": 4, "comment": "Updated comment" }
```

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Review updated successfully",
  "data": { "id": "uuid", "rating": 4, "comment": "Updated comment" }
}
```

**Error Responses:**

- `400` — Validation error
- `401` — Not authenticated
- `403` — Not the review owner (and not ADMIN)
- `404` — Review not found

---

### DELETE /api/reviews/:id

**Description:** Soft-delete a review. Owners can delete their own; ADMIN can delete any.

**Auth required:** Yes (owner or ADMIN)

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Review deleted successfully",
  "data": { "id": "uuid", "isDeleted": true }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Not the review owner (and not ADMIN)
- `404` — Review not found

---

### POST /api/reviews/:id/reply

**Description:** Reply to a review as the vendor who owns the reviewed vehicle. One reply per review.

**Auth required:** Yes — **VENDOR** only

**Request Body:**

```json
{ "content": "Thank you for your feedback!" }
```

**Query Parameters:** None

**URL Parameters:** `id` (string) — review id

**Success Response:** `201`

```json
{
  "success": true,
  "message": "Reply submitted successfully",
  "data": { "id": "uuid", "reviewId": "uuid", "vendorId": "uuid", "content": "Thank you for your feedback!", "createdAt": "...", "updatedAt": "..." }
}
```

**Error Responses:**

- `400` — Validation error (content 1–2000 chars)
- `401` — Not authenticated
- `403` — Requires VENDOR role, or not the owner of the reviewed vehicle
- `404` — Review not found
- `409` — You have already replied to this review

---

### PATCH /api/reviews/:id/reply

**Description:** Update the vendor's reply on a review.

**Auth required:** Yes — **VENDOR** only (owner of the reply and the vehicle)

**Request Body:**

```json
{ "content": "Updated thank-you message" }
```

**Query Parameters:** None

**URL Parameters:** `id` (string) — review id

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Reply updated successfully",
  "data": { "id": "uuid", "content": "Updated thank-you message" }
}
```

**Error Responses:**

- `400` — Validation error
- `401` — Not authenticated
- `403` — Requires VENDOR role, or not the owner of the reply/vehicle
- `404` — No vendor reply found on this review

---

### DELETE /api/reviews/:id/reply

**Description:** Delete a vendor reply. The replying vendor can delete their own; ADMIN can delete any.

**Auth required:** Yes — **VENDOR** or **ADMIN**

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string) — review id

**Success Response:** `200`

```json
{ "success": true, "message": "Reply deleted successfully", "data": null }
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Requires VENDOR/ADMIN role, or not the reply/vehicle owner
- `404` — No vendor reply found on this review

---

### POST /api/reviews/:id/react

**Description:** Like/dislike a review (customer). Toggle behavior: same type removes the reaction, opposite type switches it. You cannot react to your own review.

**Auth required:** Yes — **CUSTOMER** only

**Request Body:**

```json
{ "type": "LIKE" }
```

`type` is `LIKE` or `DISLIKE`.

**Query Parameters:** None

**URL Parameters:** `id` (string) — review id

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Reaction updated successfully",
  "data": { "reaction": { "id": "uuid", "type": "LIKE" }, "likeCount": 3, "dislikeCount": 1 }
}
```

`reaction` is `null` when the reaction was toggled off.

**Error Responses:**

- `400` — Validation error; or you cannot react to your own review
- `401` — Not authenticated
- `403` — Requires CUSTOMER role
- `404` — Review not found
- `409` — Could not update your reaction (after retries)

---

### DELETE /api/reviews/:id/react/:reactionId

**Description:** Delete a reaction (admin moderation).

**Auth required:** Yes — **ADMIN** only

**Request Body:** None

**Query Parameters:** None

**URL Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Review id |
| `reactionId` | string | Reaction id |

**Success Response:** `200`

```json
{ "success": true, "message": "Reaction deleted successfully", "data": null }
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Requires ADMIN role
- `404` — Reaction not found / not found on this review

---

## Wishlist

### POST /api/wishlist

**Description:** Add a vehicle to the customer's wishlist.

**Auth required:** Yes — **CUSTOMER** only

**Request Body:**

```json
{ "vehicleId": "uuid" }
```

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `201`

```json
{
  "success": true,
  "message": "Added to wishlist successfully",
  "data": { "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "createdAt": "...", "vehicle": { "id": "uuid", "name": "Toyota Camry", "category": { "id": "uuid", "name": "Sedan" } } }
}
```

**Error Responses:**

- `400` — Validation error
- `401` — Not authenticated
- `403` — Requires CUSTOMER role
- `404` — Vehicle not found
- `409` — This vehicle is already in your wishlist

---

### GET /api/wishlist/my-wishlist

**Description:** List the customer's wishlist items.

**Auth required:** Yes — **CUSTOMER** only

**Request Body:** None

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `page` | number (optional) | Page number (default `1`) |
| `limit` | number (optional) | Page size (default `10`) |

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Wishlist retrieved successfully",
  "data": [
    { "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "createdAt": "...", "vehicle": { "id": "uuid", "name": "Toyota Camry", "category": { "id": "uuid", "name": "Sedan" } } }
  ],
  "meta": { "page": 1, "limit": 10, "total": 2 }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Requires CUSTOMER role

---

### DELETE /api/wishlist/:id

**Description:** Remove an item from the customer's own wishlist.

**Auth required:** Yes — **CUSTOMER** only

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string) — wishlist item id

**Success Response:** `200`

```json
{ "success": true, "message": "Removed from wishlist successfully", "data": null }
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Requires CUSTOMER role, or not your own wishlist item
- `404` — Wishlist item not found

---

## Users

### GET /api/users

**Description:** List users with optional role/search filtering (admin management view).

**Auth required:** Yes — **ADMIN** only

**Request Body:** None

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `page` | number (optional) | Page number (default `1`) |
| `limit` | number (optional) | Page size (default `10`) |
| `role` | string (optional) | `CUSTOMER` / `VENDOR` / `ADMIN` |
| `search` | string (optional) | Case-insensitive match on name/email |

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    { "id": "uuid", "name": "John Doe", "email": "john@example.com", "phone": null, "profileImage": null, "role": "CUSTOMER", "authProvider": "credentials", "isBlocked": false, "isDeleted": false, "createdAt": "...", "updatedAt": "..." }
  ],
  "meta": { "page": 1, "limit": 10, "total": 40 }
}
```

**Error Responses:**

- `400` — Invalid query parameter values
- `401` — Not authenticated
- `403` — Requires ADMIN role

---

### GET /api/users/:id

**Description:** Get a single user. Users can view their own profile; ADMIN can view any.

**Auth required:** Yes (self or ADMIN)

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": { "id": "uuid", "name": "John Doe", "email": "john@example.com", "role": "CUSTOMER", "isBlocked": false }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — You can only view your own profile
- `404` — User not found

---

### PATCH /api/users/:id/block

**Description:** Toggle a user's `isBlocked` status. You cannot block your own account.

**Auth required:** Yes — **ADMIN** only

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "User block status updated successfully",
  "data": { "id": "uuid", "name": "John Doe", "role": "CUSTOMER", "isBlocked": true }
}
```

**Error Responses:**

- `400` — You cannot block your own account
- `401` — Not authenticated
- `403` — Requires ADMIN role
- `404` — User not found

---

### PATCH /api/users/:id

**Description:** Update the current user's own profile (name, phone, profile image).

**Auth required:** Yes (self only)

**Request Body:**

```json
{ "name": "John Updated", "phone": "+8801711111111", "profileImage": "https://.../avatar.jpg" }
```

All fields optional. Schema is strict — unknown fields are rejected.

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { "id": "uuid", "name": "John Updated", "phone": "+8801711111111", "profileImage": "https://.../avatar.jpg", "hasPassword": true }
}
```

**Error Responses:**

- `400` — Validation error (including unknown fields)
- `401` — Not authenticated
- `403` — You can only update your own profile
- `404` — User not found

---

### DELETE /api/users/:id

**Description:** Soft-delete a user (`isDeleted = true`). You cannot delete your own account.

**Auth required:** Yes — **ADMIN** only

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "User deleted successfully",
  "data": { "id": "uuid", "name": "John Doe", "isDeleted": true }
}
```

**Error Responses:**

- `400` — You cannot delete your own account
- `401` — Not authenticated
- `403` — Requires ADMIN role
- `404` — User not found

---

## Bookings

### GET /api/bookings/my-bookings

**Description:** List the customer's own bookings (optionally filtered by status).

**Auth required:** Yes — **CUSTOMER** only

**Request Body:** None

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `page` | number (optional) | Page number (default `1`) |
| `limit` | number (optional) | Page size (default `10`) |
| `status` | string (optional) | `PENDING` / `CONFIRMED` / `REJECTED` / `CANCELLED` |

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Your bookings retrieved successfully",
  "data": [
    {
      "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "startDate": "2026-02-01T00:00:00.000Z", "endDate": "2026-02-03T00:00:00.000Z",
      "totalPrice": "120.00", "status": "PENDING", "paymentStatus": "UNPAID", "paymentIntentId": null, "isDeleted": false, "createdAt": "...", "updatedAt": "...",
      "vehicle": { "id": "uuid", "name": "Toyota Camry", "category": { "id": "uuid", "name": "Sedan" } }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 3 }
}
```

**Error Responses:**

- `400` — Invalid query parameter values
- `401` — Not authenticated
- `403` — Requires CUSTOMER role

---

### GET /api/bookings/vendor-bookings

**Description:** List bookings for the authenticated vendor's vehicles, including the customer who booked.

**Auth required:** Yes — **VENDOR** only

**Request Body:** None

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `page` | number (optional) | Page number (default `1`) |
| `limit` | number (optional) | Page size (default `10`) |
| `status` | string (optional) | `PENDING` / `CONFIRMED` / `REJECTED` / `CANCELLED` |

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Booking requests retrieved successfully",
  "data": [
    {
      "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "startDate": "...", "endDate": "...", "totalPrice": "120.00", "status": "PENDING", "paymentStatus": "UNPAID",
      "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com", "phone": "+88017..." },
      "vehicle": { "id": "uuid", "name": "Toyota Camry", "category": { "id": "uuid", "name": "Sedan" } }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 2 }
}
```

**Error Responses:**

- `400` — Invalid query parameter values
- `401` — Not authenticated
- `403` — Requires VENDOR role

---

### GET /api/bookings

**Description:** List all bookings (admin view).

**Auth required:** Yes — **ADMIN** only

**Request Body:** None

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `page` | number (optional) | Page number (default `1`) |
| `limit` | number (optional) | Page size (default `10`) |
| `status` | string (optional) | `PENDING` / `CONFIRMED` / `REJECTED` / `CANCELLED` |

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Bookings retrieved successfully",
  "data": [
    {
      "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "startDate": "...", "endDate": "...", "totalPrice": "120.00", "status": "PENDING", "paymentStatus": "UNPAID",
      "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com", "phone": null },
      "vehicle": { "id": "uuid", "name": "Toyota Camry", "category": { "id": "uuid", "name": "Sedan" }, "vendor": { "id": "uuid", "name": "Vendor One" } }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 20 }
}
```

**Error Responses:**

- `400` — Invalid query parameter values
- `401` — Not authenticated
- `403` — Requires ADMIN role

---

### GET /api/bookings/:id

**Description:** Get a single booking. Accessible to the booking owner, the vehicle's vendor, or ADMIN.

**Auth required:** Yes (owner / vehicle vendor / ADMIN)

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Booking retrieved successfully",
  "data": {
    "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "startDate": "...", "endDate": "...", "totalPrice": "120.00", "status": "PENDING", "paymentStatus": "UNPAID",
    "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com", "phone": null },
    "vehicle": { "id": "uuid", "name": "Toyota Camry", "category": { "id": "uuid", "name": "Sedan" }, "vendor": { "id": "uuid", "name": "Vendor One" } }
  }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — You are not allowed to view this booking
- `404` — Booking not found

---

### POST /api/bookings

**Description:** Create a booking request for an available vehicle (customer). Creates a `PENDING` / `UNPAID` booking.

**Auth required:** Yes — **CUSTOMER** only

**Request Body:**

```json
{
  "vehicleId": "uuid",
  "startDate": "2026-02-01T00:00:00.000Z",
  "endDate": "2026-02-03T00:00:00.000Z"
}
```

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `201`

```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": { "id": "uuid", "userId": "uuid", "vehicleId": "uuid", "startDate": "...", "endDate": "...", "totalPrice": "120.00", "status": "PENDING", "paymentStatus": "UNPAID", "vehicle": { "id": "uuid", "name": "Toyota Camry" } }
}
```

`totalPrice` = `pricePerDay × days` (computed server-side).

**Error Responses:**

- `400` — Validation error; end date must be after start date; vehicle not available
- `401` — Not authenticated
- `403` — Requires CUSTOMER role
- `404` — Vehicle not found
- `409` — This vehicle is already booked for the selected dates

---

### PATCH /api/bookings/:id

**Description:** Edit the dates of a pending booking and recompute the total price. The booking owner or the vehicle's vendor can edit.

**Auth required:** Yes (owner or vehicle vendor)

**Request Body:**

```json
{ "startDate": "2026-02-05T00:00:00.000Z", "endDate": "2026-02-07T00:00:00.000Z" }
```

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Booking updated successfully",
  "data": { "id": "uuid", "startDate": "...", "endDate": "...", "totalPrice": "120.00", "vehicle": { "id": "uuid", "name": "Toyota Camry" } }
}
```

**Error Responses:**

- `400` — Validation error; end date must be after start date; only pending bookings can be edited
- `401` — Not authenticated
- `403` — Not the owner or the vehicle vendor
- `404` — Booking not found
- `409` — This vehicle is already booked for the selected dates

---

### PATCH /api/bookings/:id/status

**Description:** Approve (CONFIRMED) or reject (REJECTED) a pending booking. Only paid bookings can be approved; rejecting a paid booking triggers a Stripe refund.

**Auth required:** Yes — **VENDOR** or **ADMIN** (vendors only for their own vehicles)

**Request Body:**

```json
{ "status": "CONFIRMED" }
```

`status` is `CONFIRMED` or `REJECTED`.

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Booking status updated successfully",
  "data": { "id": "uuid", "status": "CONFIRMED", "paymentStatus": "PAID" }
}
```

**Error Responses:**

- `400` — Validation error; only pending bookings can be approved/rejected; only paid bookings can be approved
- `401` — Not authenticated
- `403` — Requires VENDOR/ADMIN role, or vendor does not own the vehicle
- `404` — Booking not found
- `409` — This vehicle is already booked for the selected dates
- `502` — Refund could not be processed by Stripe (reject path)

---

### PATCH /api/bookings/:id/cancel

**Description:** Cancel the customer's own pending booking. If already paid, triggers a full Stripe refund.

**Auth required:** Yes — **CUSTOMER** only

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": { "id": "uuid", "status": "CANCELLED", "paymentStatus": "REFUNDED" }
}
```

**Error Responses:**

- `400` — Only pending bookings can be cancelled
- `401` — Not authenticated
- `403` — Requires CUSTOMER role, or not your own booking
- `404` — Booking not found
- `502` — Refund could not be processed by Stripe

---

### DELETE /api/bookings/:id

**Description:** Soft-delete a booking. Allowed for ADMIN or the vehicle's vendor.

**Auth required:** Yes — **ADMIN** or **VENDOR**

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `id` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Booking deleted successfully",
  "data": { "id": "uuid", "isDeleted": true }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Only an admin or the vehicle's vendor can delete this booking
- `404` — Booking not found

---

## Payments

### POST /api/payments/create-checkout-session

**Description:** Create a Stripe Checkout session for a booking. Two flows:
1. **Existing booking:** pass `bookingId` to pay for it (retry path).
2. **New booking:** pass `vehicleId` + `startDate` + `endDate` to create the booking and checkout in one request.

Creates/updates an `UNPAID` payment row with the Stripe session id.

**Auth required:** Yes — **CUSTOMER** only

**Request Body:**

```json
{
  "bookingId": "uuid"
}
```

or

```json
{
  "vehicleId": "uuid",
  "startDate": "2026-02-01T00:00:00.000Z",
  "endDate": "2026-02-03T00:00:00.000Z"
}
```

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Checkout session created successfully",
  "data": { "url": "https://checkout.stripe.com/c/pay/...", "bookingId": "uuid" }
}
```

**Error Responses:**

- `400` — Provide a `bookingId` or vehicle details; this booking is already paid
- `401` — Not authenticated
- `403` — Requires CUSTOMER role; or you can only pay for your own bookings
- `404` — Booking not found
- `409` — Vehicle already booked for the selected dates (new booking flow)
- `500` — Stripe is not configured

---

### POST /api/payments/verify-session

**Description:** Verify a completed Stripe Checkout session (direct verification, no webhook). Marks the booking `paymentStatus = PAID` and persists the Stripe payment intent id. The booking `status` stays `PENDING` (awaiting vendor action). Idempotent.

**Auth required:** Yes — **CUSTOMER** or **ADMIN**

**Request Body:**

```json
{ "session_id": "cs_test_..." }
```

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "paid": true,
    "booking": { "id": "uuid", "status": "PENDING", "paymentStatus": "PAID", "vehicle": { "name": "Toyota Camry" } }
  }
}
```

**Error Responses:**

- `400` — Validation error
- `401` — Not authenticated
- `403` — Requires CUSTOMER/ADMIN role; or you can only verify your own bookings
- `404` — No booking found for this payment session
- `500` — Stripe is not configured

---

### GET /api/payments/:bookingId

**Description:** Get the payment record for a booking. Accessible to the booking owner or ADMIN.

**Auth required:** Yes (owner or ADMIN)

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** `bookingId` (string)

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Payment retrieved successfully",
  "data": {
    "id": "uuid", "bookingId": "uuid", "amount": "120.00", "currency": "usd", "stripePaymentIntentId": "pi_...", "stripeSessionId": "cs_test_...", "stripeRefundId": null, "status": "PAID", "createdAt": "...", "updatedAt": "...", "booking": { "id": "uuid", "userId": "uuid", "status": "PENDING", "paymentStatus": "PAID" }
  }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — You are not allowed to view this payment
- `404` — Payment not found

---

## Dashboard

### GET /api/dashboard/admin-stats

**Description:** Aggregate platform statistics for the admin overview page.

**Auth required:** Yes — **ADMIN** only

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Admin dashboard data retrieved successfully",
  "data": {
    "stats": {
      "totalUsers": 40,
      "totalVendors": 3,
      "totalCustomers": 35,
      "totalVehicles": 42,
      "totalBookings": 120,
      "totalRevenue": 15000,
      "pendingBookings": 5
    }
  }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Requires ADMIN role

---

### GET /api/dashboard/vendor-stats

**Description:** Aggregate statistics for the vendor's own business.

**Auth required:** Yes — **VENDOR** only

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Vendor dashboard data retrieved successfully",
  "data": {
    "stats": { "totalVehicles": 5, "totalBookings": 20, "totalEarnings": 3000, "pendingBookings": 2 }
  }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Requires VENDOR role

---

### GET /api/dashboard/customer-stats

**Description:** Aggregate statistics for the customer's own activity.

**Auth required:** Yes — **CUSTOMER** only

**Request Body:** None

**Query Parameters:** None

**URL Parameters:** None

**Success Response:** `200`

```json
{
  "success": true,
  "message": "Customer dashboard data retrieved successfully",
  "data": {
    "stats": { "totalBookings": 3, "activeBookings": 1, "totalSpent": 360, "wishlistCount": 2 }
  }
}
```

**Error Responses:**

- `401` — Not authenticated
- `403` — Requires CUSTOMER role

---

## Utility

### GET /health

**Description:** Liveness/health check for the server (mounted in `app.ts` **outside** the `/api` prefix).

**Auth required:** No

**Request Body:** None

**Success Response:** `200`

```json
{ "success": true, "message": "Wheelio server is running", "data": { "uptime": 123.45, "timestamp": "2026-01-01T00:00:00.000Z" } }
```

---

## Enums

Defined in `prisma/schema.prisma`:

| Enum | Values |
|------|--------|
| `UserRole` | `CUSTOMER`, `VENDOR`, `ADMIN` |
| `VehicleStatus` | `AVAILABLE`, `BOOKED`, `MAINTENANCE`, `INACTIVE` |
| `BookingStatus` | `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED` |
| `PaymentStatus` | `UNPAID`, `PAID`, `REFUNDED` |
| `ReactionType` | `LIKE`, `DISLIKE` |

---

## Database Models Overview

All IDs are UUIDs (`@default(uuid())`). Soft-delete is implemented via `isDeleted` (Boolean, default `false`) on `User`, `Category`, `Vehicle`, `Booking`, and `Review`. Timestamps `createdAt` / `updatedAt` are present on every model except `ReviewReaction` (createdAt only) and `Wishlist` (createdAt only).

| Model | Description |
|-------|-------------|
| `User` | Accounts for all three roles (`CUSTOMER`, `VENDOR`, `ADMIN`). Supports credentials (`email` + bcrypt `password`) or Google auth (`googleId` + `authProvider = "google"`). Includes `isBlocked`. |
| `Category` | Vehicle category/type (e.g. Sedan, SUV, Bike) with a unique `name`. |
| `Vehicle` | A rental listing owned by a vendor and assigned to a category. Stores images, `pricePerDay` (Decimal 10,2), status and location. |
| `Booking` | A rental request linking a customer to a vehicle with `startDate`, `endDate`, computed `totalPrice`, `status` and `paymentStatus`. |
| `Review` | A customer's star rating (1–5) and optional comment on a vehicle. One review per user per vehicle (`@@unique([userId, vehicleId])`). |
| `ReviewReply` | A vendor's reply to a review. One per review (`reviewId` unique). |
| `ReviewReaction` | A `LIKE`/`DISLIKE` on a review. One per user per review (`@@unique([reviewId, userId])`). |
| `Wishlist` | A saved vehicle for a customer. One per user per vehicle. |
| `Payment` | Stripe payment record tied 1:1 to a booking (`bookingId` unique). Stores session/payment-intent/refund ids and `status`. |

### Key relationships

| Relationship | Type |
|--------------|------|
| `User` → `Vehicle` (via `vendorId`) | one-to-many |
| `Category` → `Vehicle` | one-to-many |
| `User` → `Booking` | one-to-many |
| `Vehicle` → `Booking` | one-to-many |
| `User` → `Review` | one-to-many |
| `Vehicle` → `Review` | one-to-many |
| `Review` → `ReviewReply` | one-to-one |
| `Review` → `ReviewReaction` | one-to-many |
| `User` → `Wishlist`, `Vehicle` → `Wishlist` | one-to-many each |
| `Booking` → `Payment` | one-to-one |
