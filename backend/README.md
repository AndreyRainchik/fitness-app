# Fitness App Backend

## Setup Complete ✅

### Database Setup ✅
- **SQLite database**: `fitness.db` (48KB)
- **6 tables created**: users, exercises, workouts, sets, programs, program_lifts
- **34 exercises seeded**: Common barbell, dumbbell, and bodyweight exercises
- **Indexes created**: For optimized queries

### Test Database:
```bash
node src/test-db.js      # Test database connection
node src/test-models.js  # Test all models (comprehensive)
```

### Installed Dependencies:
- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **bcryptjs**: Password hashing (pure JS)
- **jsonwebtoken**: JWT authentication
- **sql.js**: SQLite database (pure JS)
- **express-validator**: Input validation

### Project Structure:
```
backend/
├── src/
│   ├── config/       # Database configuration ✅
│   ├── models/       # Data models ✅
│   │   ├── User.js        # User authentication & profiles
│   │   ├── Exercise.js    # Exercise library
│   │   ├── Workout.js     # Workout sessions
│   │   ├── Set.js         # Individual sets
│   │   ├── Program.js     # Training programs
│   │   ├── index.js       # Model exports
│   │   └── README.md      # Models documentation
│   ├── routes/       # API routes (next step)
│   ├── middleware/   # Custom middleware (next step)
│   ├── utils/        # Helper functions (next step)
│   └── server.js     # Main Express server ✅
├── package.json      # Dependencies ✅
└── .env              # Environment variables ✅
```

### Available Scripts:
- `npm start`: Start the server
- `npm run dev`: Start with auto-reload (Node 18+)
- `npm run test:hevy`: Hevy import tests (uses a fake Hevy server and a throwaway database)

### Environment Variables (.env):
- `PORT=3000`: Server port
- `NODE_ENV=development`: Environment
- `JWT_SECRET`: Secret for JWT tokens
- `DB_PATH=./fitness.db`: SQLite database path
- `SECRETS_ENCRYPTION_KEY` (optional): Key for encrypting stored Hevy API keys. Defaults to one derived from `JWT_SECRET`; changing either means users re-enter their Hevy key.
- `HEVY_API_BASE_URL` (optional): Override `https://api.hevyapp.com` (tests only)

### Current Endpoints:
- `GET /health`: Health check
- `GET /api`: API info

### Hevy import (`/api/hevy`, `routes/hevy.js`)
Users choose which Hevy workouts to import; nothing syncs on its own. Needs a Hevy Pro API key
(hevy.com > Settings > Developer), entered in Profile > Integrations and stored encrypted.
- `GET /status`, `PUT /connection` (`{ api_key }`, checked against Hevy before saving), `DELETE /connection`
- `GET /workouts?page=&mode=all|new`: a page of Hevy workouts (10 per page, Hevy's limit), each marked
  `new`, `imported` or `changed` (edited in Hevy after import). `new` mode lists workouts changed since the last import.
- `POST /preview` (`{ workout_ids }`): the exercises those workouts use, with a suggested match
  (the user's earlier choice, else by name) and defaults for creating a new exercise
- `POST /import` (`{ workout_ids, exercises, timezone }`): each exercise maps to `{ exercise_id }`,
  `{ create: {...} }` or `{ skip: true }`. Weights are converted from kg to the user's units; RPE is
  copied only when logged. Re-importing a workout replaces its sets instead of duplicating it.

Bodyweight goes the other way, also on demand (Profile > Bodyweight > Send to Hevy):
- `GET /weight`: one row per date (its latest entry; Hevy keeps one weight per date), each
  `synced`, `not_synced` or `changed` (edited here since it was sent)
- `POST /weight/sync` (`{ dates? }`): sends the given dates, or up to 60 not yet in Hevy. Hevy
  answers 409 when the date already has an entry; we then read that entry and PUT it back with only
  `weight_kg` changed, because Hevy's PUT sets any field left out to null (that would erase body fat,
  waist, etc.). Same weight already there: no write. Rate limiting or a rejected key stops the batch;
  unsent dates stay pending. Hevy's API has no delete, so deleting an entry here leaves it in Hevy.

## To Run:
```bash
cd backend
npm start
```

Server will start at http://localhost:3000