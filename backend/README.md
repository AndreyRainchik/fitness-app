# Fitness App Backend

## Setup Complete ✅

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
│   ├── config/       # Database configuration (next step)
│   ├── models/       # Data models (next step)
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

### Environment Variables (.env):
- `PORT=3000`: Server port
- `NODE_ENV=development`: Environment
- `JWT_SECRET`: Secret for JWT tokens
- `DB_PATH=./fitness.db`: SQLite database path

### Current Endpoints:
- `GET /health`: Health check
- `GET /api`: API info

## To Run:
```bash
cd backend
npm start
```

Server will start at http://localhost:3000