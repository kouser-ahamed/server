# Wheelio API Documentation

Base URL: `http://localhost:5000/api`

- All JSON request/response bodies use the `Content-Type: application/json` header (except the Stripe webhook, which uses raw JSON).
- **Authentication**: Send the JWT either as a Bearer token in the `Authorization` header (`Authorization: Bearer <token>`) or as an `httpOnly` cookie named `token` (set automatically on login/google-login).
- **Success response shape**:
  ```json
  { "success": true, "message": "...", "data": { ... }, "meta": { "page": 1, "limit": 10, "total": 0 } }
  ```
- **Error response shape**:
  ```json
  { "success": false, "message": "...", "data": null, "statusCode": 400, "errors": [...] }
  ```

Common error codes (unless noted per endpoint):

| Code | Meaning |
| ---- | ------- |
| 400 | Validation failed / bad request |
| 401 | Missing/invalid token, or wrong credentials |
| 403 | Authenticated but not allowed (wrong role / not owner) |
| 404 | Resource not found |
| 409 | Conflict (duplicate or conflicting state) |
| 500 | Server / DB / external service error |

---

## Auth

Base path: `/api/auth`

### POST /api/auth/register

Creates a new user account.

- **Auth**: None
- **Request body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "secret123",
    "phone": "+8801700000000",
    "role": "CUSTOMER"
  }
  ```
  `phone` and `role` (`CUSTOMER` | `VENDOR`, defaults to `CUSTOMER`) are optional.
- **Success (201 Created)**:
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
        "createdAt": "2026-08-10T00:00:00.000Z"
      }
    }
  }
  ```
- **Errors**: `400` (validation), `409` (email already exists), `500`

### POST /api/auth/login

Logs a user in. Sets the JWT in an `httpOnly` cookie and returns it in the body.

- **Auth**: None
- **Request body**:
  ```json
  { "email": "john@example.com", "password": "secret123" }
  ```
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": null,
        "profileImage": null,
        "role": "CUSTOMER",
        "authProvider": "credentials",
        "createdAt": "2026-08-10T00:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
  ```
- **Errors**: `400` (validation), `401` (invalid email/password, Google-only email, no password), `403` (account blocked)

### POST /api/auth/google-login

Logs in or creates a user via a Google ID token.

- **Auth**: None
- **Request body**:
  ```json
  { "credential": "google-id-token" }
  ```
- **Success (200 OK)**: same shape as `login`, with `message: "Google login successful"`.
- **Errors**: `400` (validation), `401` (invalid/expired Google token), `403` (account blocked), `500` (Google not configured)

### POST /api/auth/logout

Clears the auth cookie. No token required.

- **Auth**: None
- **Request body**: none
- **Success (200 OK)**:
  ```json
  { "success": true, "message": "Logged out successfully", "data": null }
  ```
- **Errors**: `500`

### GET /api/auth/me

Returns the currently authenticated user's profile.

- **Auth**: Required (any role)
- **Request body**: none
- **Success (200 OK)**:
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
        "role": "CUSTOMER",
        "authProvider": "credentials",
        "isBlocked": false,
        "createdAt": "2026-08-10T00:00:00.000Z",
        "updatedAt": "2026-08-10T00:00:00.000Z"
      }
    }
  }
  ```
- **Errors**: `401`, `404` (user not found)

---

## Users

Base path: `/api/users`

### GET /api/users

Lists all users (paginated, filterable). Admin only.

- **Auth**: Required — role `ADMIN`
- **Query params** (all optional): `page`, `limit`, `role` (`CUSTOMER` | `VENDOR` | `ADMIN`), `search` (matches name/email)
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Users retrieved successfully",
    "data": [
      {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": null,
        "profileImage": null,
        "role": "CUSTOMER",
        "authProvider": "credentials",
        "isBlocked": false,
        "isDeleted": false,
        "createdAt": "2026-08-10T00:00:00.000Z",
        "updatedAt": "2026-08-10T00:00:00.000Z"
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 1 }
  }
  ```
- **Errors**: `400`, `401`, `403`

### GET /api/users/:id

Gets a single user. Users can only view their own profile; admins can view anyone.

- **Auth**: Required (own account or `ADMIN`)
- **Request body**: none
- **Success (200 OK)**: `message: "User retrieved successfully"`, `data` = one user object (same shape as above).
- **Errors**: `400`, `401`, `403` (not your own profile), `404`

### PATCH /api/users/:id

Updates the logged-in user's own profile.

- **Auth**: Required (own account only)
- **Request body** (all optional):
  ```json
  { "name": "John Smith", "phone": "+8801711111111", "profileImage": "https://example.com/avatar.jpg" }
  ```
- **Success (200 OK)**: `message: "Profile updated successfully"`, `data` = updated user object.
- **Errors**: `400` (validation), `401`, `403` (not your own profile), `404`

### PATCH /api/users/:id/block

Toggles the `isBlocked` flag of a user. Admin only.

- **Auth**: Required — role `ADMIN`
- **Request body**: none
- **Success (200 OK)**: `message: "User block status updated successfully"`, `data` = updated user object.
- **Errors**: `400` (cannot block own account), `401`, `403`, `404`

### DELETE /api/users/:id

Soft-deletes a user (sets `isDeleted: true`). Admin only.

- **Auth**: Required — role `ADMIN`
- **Request body**: none
- **Success (200 OK)**: `message: "User deleted successfully"`, `data` = updated user object.
- **Errors**: `400` (cannot delete own account), `401`, `403`, `404`

---

## Categories

Base path: `/api/categories`

### POST /api/categories

Creates a category. Admin only.

- **Auth**: Required — role `ADMIN`
- **Request body**:
  ```json
  { "name": "SUV", "description": "Sports utility vehicles", "icon": "🚙" }
  ```
  `description` and `icon` are optional.
- **Success (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Category created successfully",
    "data": {
      "id": "uuid",
      "name": "SUV",
      "description": "Sports utility vehicles",
      "icon": "🚙",
      "isDeleted": false,
      "createdAt": "2026-08-10T00:00:00.000Z",
      "updatedAt": "2026-08-10T00:00:00.000Z"
    }
  }
  ```
- **Errors**: `400` (validation), `401`, `403`, `409` (name already exists)

### GET /api/categories

Lists categories (paginated). Public.

- **Auth**: None
- **Query params**: `page`, `limit` (default `20`)
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Categories retrieved successfully",
    "data": [
      {
        "id": "uuid",
        "name": "SUV",
        "description": "Sports utility vehicles",
        "icon": "🚙",
        "isDeleted": false,
        "createdAt": "2026-08-10T00:00:00.000Z",
        "updatedAt": "2026-08-10T00:00:00.000Z",
        "_count": { "vehicles": 3 }
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 1 }
  }
  ```
- **Errors**: `500`

### GET /api/categories/:id

Gets a category with its vehicles.

- **Auth**: None
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Category retrieved successfully",
    "data": {
      "id": "uuid",
      "name": "SUV",
      "description": "Sports utility vehicles",
      "icon": "🚙",
      "isDeleted": false,
      "createdAt": "2026-08-10T00:00:00.000Z",
      "updatedAt": "2026-08-10T00:00:00.000Z",
      "vehicles": []
    }
  }
  ```
- **Errors**: `404` (category not found), `500`

### PATCH /api/categories/:id

Updates a category. Admin only.

- **Auth**: Required — role `ADMIN`
- **Request body** (all optional):
  ```json
  { "name": "Luxury SUV", "description": "High-end SUVs" }
  ```
- **Success (200 OK)**: `message: "Category updated successfully"`, `data` = updated category object.
- **Errors**: `400`, `401`, `403`, `404`

### DELETE /api/categories/:id

Soft-deletes a category. Cannot delete categories that still have vehicles. Admin only.

- **Auth**: Required — role `ADMIN`
- **Request body**: none
- **Success (200 OK)**: `message: "Category deleted successfully"`, `data` = updated category object.
- **Errors**: `400` (category still has vehicles), `401`, `403`, `404`

---

## Vehicles

Base path: `/api/vehicles`

### GET /api/vehicles

Lists available vehicles with filters, search, and sorting (paginated). Public.

- **Auth**: None
- **Query params** (all optional): `page`, `limit` (default `10`), `categoryId`, `minPrice`, `maxPrice`, `status` (`AVAILABLE` | `BOOKED` | `MAINTENANCE` | `INACTIVE`), `search` (name/brand/model), `sort` (`price_asc` | `price_desc` | `newest`)
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Vehicles retrieved successfully",
    "data": [
      {
        "id": "uuid",
        "name": "Toyota Land Cruiser",
        "brand": "Toyota",
        "model": "Land Cruiser",
        "images": ["https://example.com/car.jpg"],
        "pricePerDay": "150.00",
        "description": "Comfortable 4x4 for long trips.",
        "status": "AVAILABLE",
        "location": "Dhaka",
        "vendorId": "uuid",
        "categoryId": "uuid",
        "isDeleted": false,
        "createdAt": "2026-08-10T00:00:00.000Z",
        "updatedAt": "2026-08-10T00:00:00.000Z",
        "category": { "id": "uuid", "name": "SUV" }
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 1 }
  }
  ```
- **Errors**: `400`, `500`

### GET /api/vehicles/my-vehicles

Lists the vendor's own vehicles (paginated). Vendor only.

- **Auth**: Required — role `VENDOR`
- **Query params**: `page`, `limit` (default `10`)
- **Request body**: none
- **Success (200 OK)**: `message: "Your vehicles retrieved successfully"`, `data` = vehicles (each includes `category` and `_count.bookings`), plus `meta`.
- **Errors**: `400`, `401`, `403`

### POST /api/vehicles

Creates a vehicle. Vendor only.

- **Auth**: Required — role `VENDOR`
- **Request body**:
  ```json
  {
    "categoryId": "uuid",
    "name": "Toyota Land Cruiser",
    "brand": "Toyota",
    "model": "Land Cruiser",
    "images": ["https://example.com/car.jpg"],
    "pricePerDay": 150,
    "description": "Comfortable 4x4 for long trips.",
    "status": "AVAILABLE",
    "location": "Dhaka"
  }
  ```
  `status` (`AVAILABLE` | `BOOKED` | `MAINTENANCE` | `INACTIVE`, default `AVAILABLE`) and `location` are optional.
- **Success (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Vehicle created successfully",
    "data": {
      "id": "uuid",
      "name": "Toyota Land Cruiser",
      "brand": "Toyota",
      "model": "Land Cruiser",
      "images": ["https://example.com/car.jpg"],
      "pricePerDay": "150.00",
      "description": "Comfortable 4x4 for long trips.",
      "status": "AVAILABLE",
      "location": "Dhaka",
      "vendorId": "uuid",
      "categoryId": "uuid",
      "isDeleted": false,
      "createdAt": "2026-08-10T00:00:00.000Z",
      "updatedAt": "2026-08-10T00:00:00.000Z",
      "category": { "id": "uuid", "name": "SUV" }
    }
  }
  ```
- **Errors**: `400` (validation), `401`, `403`, `404` (category not found)

### GET /api/vehicles/:id

Gets a single vehicle with category, vendor, reviews, and computed rating. Public.

- **Auth**: None
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Vehicle retrieved successfully",
    "data": {
      "id": "uuid",
      "name": "Toyota Land Cruiser",
      "brand": "Toyota",
      "model": "Land Cruiser",
      "images": ["https://example.com/car.jpg"],
      "pricePerDay": "150.00",
      "description": "Comfortable 4x4 for long trips.",
      "status": "AVAILABLE",
      "location": "Dhaka",
      "vendorId": "uuid",
      "categoryId": "uuid",
      "isDeleted": false,
      "createdAt": "2026-08-10T00:00:00.000Z",
      "updatedAt": "2026-08-10T00:00:00.000Z",
      "category": { "id": "uuid", "name": "SUV" },
      "vendor": { "id": "uuid", "profileImage": null, "role": "VENDOR" },
      "reviews": [],
      "averageRating": 0,
      "reviewCount": 0
    }
  }
  ```
- **Errors**: `404` (vehicle not found), `500`

### PATCH /api/vehicles/:id

Updates a vehicle. Allowed for the owning vendor or an admin.

- **Auth**: Required — role `VENDOR` or `ADMIN` (must own the vehicle unless admin)
- **Request body**: any subset of the create payload (e.g. `{ "pricePerDay": 180 }`)
- **Success (200 OK)**: `message: "Vehicle updated successfully"`, `data` = updated vehicle object (includes `category`).
- **Errors**: `400`, `401`, `403` (not the owner), `404`

### DELETE /api/vehicles/:id

Soft-deletes a vehicle. Cannot delete a vehicle with active bookings. Allowed for the owning vendor or an admin.

- **Auth**: Required — role `VENDOR` or `ADMIN` (must own the vehicle unless admin)
- **Request body**: none
- **Success (200 OK)**: `message: "Vehicle deleted successfully"`, `data` = updated vehicle object.
- **Errors**: `400` (has active bookings), `401`, `403`, `404`

---

## Bookings

Base path: `/api/bookings`

### GET /api/bookings/my-bookings

Lists the logged-in customer's bookings (paginated). Customer only.

- **Auth**: Required — role `CUSTOMER`
- **Query params**: `page`, `limit` (default `10`), `status` (`PENDING` | `CONFIRMED` | `ONGOING` | `COMPLETED` | `CANCELLED` | `REJECTED`)
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Your bookings retrieved successfully",
    "data": [
      {
        "id": "uuid",
        "userId": "uuid",
        "vehicleId": "uuid",
        "startDate": "2026-09-01T00:00:00.000Z",
        "endDate": "2026-09-05T00:00:00.000Z",
        "totalPrice": "600.00",
        "status": "PENDING",
        "paymentStatus": "UNPAID",
        "isDeleted": false,
        "createdAt": "2026-08-10T00:00:00.000Z",
        "updatedAt": "2026-08-10T00:00:00.000Z",
        "vehicle": { "id": "uuid", "name": "Toyota Land Cruiser", "category": { "id": "uuid", "name": "SUV" } }
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 1 }
  }
  ```
- **Errors**: `400`, `401`, `403`

### GET /api/bookings/vendor-bookings

Lists bookings for the vendor's own vehicles (paginated). Vendor only.

- **Auth**: Required — role `VENDOR`
- **Query params**: `page`, `limit`, `status`
- **Request body**: none
- **Success (200 OK)**: `message: "Booking requests retrieved successfully"`, `data` = bookings (each includes `user` and `vehicle`), plus `meta`.
- **Errors**: `400`, `401`, `403`

### GET /api/bookings

Lists all bookings (paginated). Admin only.

- **Auth**: Required — role `ADMIN`
- **Query params**: `page`, `limit`, `status`
- **Request body**: none
- **Success (200 OK)**: `message: "Bookings retrieved successfully"`, `data` = bookings (each includes `user` and `vehicle`), plus `meta`.
- **Errors**: `400`, `401`, `403`

### GET /api/bookings/:id

Gets a single booking. Accessible to the booking owner, the vehicle's vendor, or an admin.

- **Auth**: Required (owner / vendor / `ADMIN`)
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Booking retrieved successfully",
    "data": {
      "id": "uuid",
      "userId": "uuid",
      "vehicleId": "uuid",
      "startDate": "2026-09-01T00:00:00.000Z",
      "endDate": "2026-09-05T00:00:00.000Z",
      "totalPrice": "600.00",
      "status": "PENDING",
      "paymentStatus": "UNPAID",
      "isDeleted": false,
      "createdAt": "2026-08-10T00:00:00.000Z",
      "updatedAt": "2026-08-10T00:00:00.000Z",
      "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com", "phone": null },
      "vehicle": { "id": "uuid", "name": "Toyota Land Cruiser", "category": { "id": "uuid", "name": "SUV" }, "vendor": { "id": "uuid", "name": "Vendor Name" } }
    }
  }
  ```
- **Errors**: `401`, `403` (not owner/vendor/admin), `404`

### POST /api/bookings

Creates a booking for a vehicle. Customer only. `totalPrice` is computed as `pricePerDay × days`.

- **Auth**: Required — role `CUSTOMER`
- **Request body**:
  ```json
  {
    "vehicleId": "uuid",
    "startDate": "2026-09-01",
    "endDate": "2026-09-05"
  }
  ```
- **Success (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Booking created successfully",
    "data": {
      "id": "uuid",
      "userId": "uuid",
      "vehicleId": "uuid",
      "startDate": "2026-09-01T00:00:00.000Z",
      "endDate": "2026-09-05T00:00:00.000Z",
      "totalPrice": "600.00",
      "status": "PENDING",
      "paymentStatus": "UNPAID",
      "isDeleted": false,
      "createdAt": "2026-08-10T00:00:00.000Z",
      "updatedAt": "2026-08-10T00:00:00.000Z",
      "vehicle": { "id": "uuid", "name": "Toyota Land Cruiser", "status": "BOOKED" }
    }
  }
  ```
- **Errors**: `400` (invalid dates / vehicle not available), `401`, `403`, `404` (vehicle not found), `409` (dates overlap with existing booking)

### PATCH /api/bookings/:id/status

Confirms or rejects a pending booking. Vendor or admin (vendors may only manage their own vehicles).

- **Auth**: Required — role `VENDOR` or `ADMIN`
- **Request body**:
  ```json
  { "status": "CONFIRMED" }
  ```
  `status` is `CONFIRMED` | `REJECTED`.
- **Success (200 OK)**: `message: "Booking status updated successfully"`, `data` = updated booking object. Confirming sets `vehicle.status = BOOKED`; rejecting releases the vehicle if free.
- **Errors**: `400` (booking is not `PENDING`), `401`, `403` (not the vendor of the vehicle), `404`, `409` (overlapping booking on confirm)

### PATCH /api/bookings/:id/cancel

Cancels the customer's own pending or confirmed booking.

- **Auth**: Required — role `CUSTOMER`
- **Request body**: none
- **Success (200 OK)**: `message: "Booking cancelled successfully"`, `data` = updated booking object (`status: "CANCELLED"`). Vehicle is released if it has no other active bookings.
- **Errors**: `400` (booking is not `PENDING`/`CONFIRMED`), `401`, `403` (not your booking), `404`

### DELETE /api/bookings/:id

Soft-deletes a booking. Admin only.

- **Auth**: Required — role `ADMIN`
- **Request body**: none
- **Success (200 OK)**: `message: "Booking deleted successfully"`, `data` = updated booking object (`isDeleted: true`). Vehicle is released if free.
- **Errors**: `401`, `403`, `404`

---

## Reviews

Base path: `/api/reviews`

### GET /api/reviews/vehicle/:vehicleId

Lists reviews for a vehicle (paginated). Public.

- **Auth**: None
- **Query params**: `page`, `limit` (default `10`)
- **Request body**: none
- **Success (200 OK)**:
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
        "createdAt": "2026-08-10T00:00:00.000Z",
        "updatedAt": "2026-08-10T00:00:00.000Z",
        "user": { "id": "uuid", "name": "John Doe", "profileImage": null }
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 1 }
  }
  ```
- **Errors**: `400`, `500`

### POST /api/reviews

Creates a review. The customer must have a `COMPLETED` booking for the vehicle, and can only review once. Customer only.

- **Auth**: Required — role `CUSTOMER`
- **Request body**:
  ```json
  { "vehicleId": "uuid", "rating": 5, "comment": "Great car!" }
  ```
  `comment` is optional; `rating` must be an integer 1–5.
- **Success (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Review submitted successfully",
    "data": {
      "id": "uuid",
      "userId": "uuid",
      "vehicleId": "uuid",
      "rating": 5,
      "comment": "Great car!",
      "isDeleted": false,
      "createdAt": "2026-08-10T00:00:00.000Z",
      "updatedAt": "2026-08-10T00:00:00.000Z",
      "user": { "id": "uuid", "name": "John Doe", "profileImage": null }
    }
  }
  ```
- **Errors**: `400` (rating invalid / cannot review own vehicle / no completed booking), `401`, `403`, `404` (vehicle not found), `409` (already reviewed)

### PATCH /api/reviews/:id

Updates the user's own review.

- **Auth**: Required (own review only)
- **Request body** (all optional):
  ```json
  { "rating": 4, "comment": "Updated comment" }
  ```
- **Success (200 OK)**: `message: "Review updated successfully"`, `data` = updated review object.
- **Errors**: `400`, `401`, `403` (not your review), `404`

### DELETE /api/reviews/:id

Soft-deletes a review. The review author or an admin can delete.

- **Auth**: Required (author or `ADMIN`)
- **Request body**: none
- **Success (200 OK)**: `message: "Review deleted successfully"`, `data` = updated review object (`isDeleted: true`).
- **Errors**: `401`, `403`, `404`

---

## Wishlist

Base path: `/api/wishlist`

### POST /api/wishlist

Adds a vehicle to the customer's wishlist. Customer only.

- **Auth**: Required — role `CUSTOMER`
- **Request body**:
  ```json
  { "vehicleId": "uuid" }
  ```
- **Success (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Added to wishlist successfully",
    "data": {
      "id": "uuid",
      "userId": "uuid",
      "vehicleId": "uuid",
      "createdAt": "2026-08-10T00:00:00.000Z",
      "vehicle": {
        "id": "uuid",
        "name": "Toyota Land Cruiser",
        "pricePerDay": "150.00",
        "status": "AVAILABLE",
        "category": { "id": "uuid", "name": "SUV" }
      }
    }
  }
  ```
- **Errors**: `400`, `401`, `403`, `404` (vehicle not found), `409` (already in wishlist)

### GET /api/wishlist/my-wishlist

Lists the customer's wishlist (paginated). Customer only.

- **Auth**: Required — role `CUSTOMER`
- **Query params**: `page`, `limit` (default `10`)
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Wishlist retrieved successfully",
    "data": [
      {
        "id": "uuid",
        "userId": "uuid",
        "vehicleId": "uuid",
        "createdAt": "2026-08-10T00:00:00.000Z",
        "vehicle": { "id": "uuid", "name": "Toyota Land Cruiser", "category": { "id": "uuid", "name": "SUV" } }
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 1 }
  }
  ```
- **Errors**: `400`, `401`, `403`

### DELETE /api/wishlist/:id

Removes an item from the customer's wishlist. Customer only.

- **Auth**: Required — role `CUSTOMER`
- **Request body**: none
- **Success (200 OK)**:
  ```json
  { "success": true, "message": "Removed from wishlist successfully", "data": null }
  ```
- **Errors**: `401`, `403` (not your wishlist item), `404`

---

## Payments

Base path: `/api/payments`

### POST /api/payments/create-checkout-session

Creates a Stripe Checkout session for an unpaid booking owned by the customer. Returns the hosted checkout URL.

- **Auth**: Required — role `CUSTOMER`
- **Request body**:
  ```json
  { "bookingId": "uuid" }
  ```
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Checkout session created successfully",
    "data": { "url": "https://checkout.stripe.com/c/pay/cs_test_..." }
  }
  ```
  On success Stripe redirects to `{CLIENT_URL}/payment/success?bookingId={bookingId}`, or on cancel to `{CLIENT_URL}/payment/cancel?bookingId={bookingId}`.
- **Errors**: `400` (validation / booking already paid), `401`, `403` (not the booking owner), `404` (booking not found), `500` (Stripe not configured)

### POST /api/payments/webhook

Stripe webhook endpoint. Must be called by Stripe with the `stripe-signature` header; the raw JSON body is verified with `STRIPE_WEBHOOK_SECRET`. On `checkout.session.completed` it marks the payment as `PAID`, sets the booking to `CONFIRMED`/`PAID`, and sets the vehicle to `BOOKED`.

- **Auth**: None (verified via Stripe signature header)
- **Headers**: `stripe-signature: <sig>`
- **Request body**: raw JSON (Stripe event) — do **not** send JSON-parsed body.
- **Success (200 OK)**:
  ```json
  { "received": true }
  ```
- **Errors**: `400` (missing/invalid signature), `500` (webhook secret or Stripe not configured)

### GET /api/payments/:bookingId

Returns the payment status for a booking. Accessible to the booking owner or an admin.

- **Auth**: Required (owner or `ADMIN`)
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Payment retrieved successfully",
    "data": {
      "id": "uuid",
      "bookingId": "uuid",
      "amount": "600.00",
      "currency": "usd",
      "stripePaymentIntentId": null,
      "stripeSessionId": "cs_test_...",
      "status": "PAID",
      "createdAt": "2026-08-10T00:00:00.000Z",
      "updatedAt": "2026-08-10T00:00:00.000Z",
      "booking": { "id": "uuid", "userId": "uuid", "status": "CONFIRMED", "paymentStatus": "PAID" }
    }
  }
  ```
- **Errors**: `401`, `403` (not owner/admin), `404`

---

## Dashboard

Base path: `/api/dashboard`

### GET /api/dashboard/admin-stats

Aggregate platform statistics. Admin only.

- **Auth**: Required — role `ADMIN`
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Admin dashboard data retrieved successfully",
    "data": {
      "stats": {
        "totalUsers": 50,
        "totalVendors": 5,
        "totalCustomers": 44,
        "totalVehicles": 20,
        "totalBookings": 80,
        "totalRevenue": 25000,
        "pendingBookings": 6
      }
    }
  }
  ```
- **Errors**: `401`, `403`, `500`

### GET /api/dashboard/vendor-stats

Statistics scoped to the logged-in vendor. Vendor only.

- **Auth**: Required — role `VENDOR`
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Vendor dashboard data retrieved successfully",
    "data": {
      "stats": {
        "totalVehicles": 8,
        "totalBookings": 25,
        "totalEarnings": 5200,
        "pendingBookings": 3
      }
    }
  }
  ```
- **Errors**: `401`, `403`, `500`

### GET /api/dashboard/customer-stats

Statistics scoped to the logged-in customer. Customer only.

- **Auth**: Required — role `CUSTOMER`
- **Request body**: none
- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Customer dashboard data retrieved successfully",
    "data": {
      "stats": {
        "totalBookings": 12,
        "activeBookings": 2,
        "totalSpent": 3400,
        "wishlistCount": 5
      }
    }
  }
  ```
- **Errors**: `401`, `403`, `500`
