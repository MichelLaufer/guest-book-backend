import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcrypt-nodejs'


// Setting up MongoDB database
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/authGuestbook"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

// Creating mongoose models for user and (guest) book
const User = mongoose.model('User', {
  name: {
    type: String,
    unique: true,
    required: true
  },
  email: {
    type: String,
    unique: true,
    required: true
  }, 
  password: {
    type: String,
    required: true,
    minlength: 5
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  },
  bookposts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Book"
  }]
})

const Book = mongoose.model("Book", {
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  message: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 140
  },
  likes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})


// Defines the port the app will run on
const port = process.env.PORT || 8082
const app = express()

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

// Authenticate users
const authenticateUser = async (req, res, next) => {
  const user = await User.findOne({ accessToken: req.header('Authorization')})
  if (user) {
    req.user = user
    next()
  } else {
    res.status(403).json({ message: "You need to login to access this page"})
  }
}

// Start defining the routes
app.get('/', (req, res) => {
  res.send('Backend for guest book')
})



// POST routes ///////////////////////////////////////////////////////////////
// Create user 
app.post('/users', async (req, res) => {
  try {
    const { name, email, password } = req.body
    const user = new User({ name, email, password: bcrypt.hashSync(password)})
    const saved = await user.save()
    res.status(201).json(saved)
  } catch (err) {
    res.status(400).json({ message: 'Could not create user', errors: err.errors })
  }
})

// Login session
app.post('/sessions', async (req, res) => {
  const user = await User.findOne({ email: req.body.email })
  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    res.json({ name: user.name, userId: user._id, accessToken: user.accessToken })
  } else {
    // Failure because user doesn't exist or encrypted password doesn't match
    res.status(400).json({ notFound: true })
  }
})

// An individual user posting messages
app.post('/users/:userId', async (req, res) => {
  const {message} = req.body
  const book = new Book({message})

  try {
    const savedPost = await book.save()
    res.status(201).json(savedPost)
  } catch(err) {
    res.status(400).json({message: 'Could not save post to the database', error: err.errors})
  }
})

// An individual user liking messages
app.post('/users/:userId/:postLiked/like', async (req, res) => {
  const {postId} = req.params
  try {
    await Book.updateOne({'_id': postId}, {'$inc': {'likes': 1}})
    res.status(201).json()
  } catch (err) {
    res.status(400).json({message: 'Could not find the post', error: err.errors})
  }
})



// GET routes /////////////////////////////////////////////////////////////////
// This will only be shown if the next()-function is called from the middleware
app.get('/secrets', authenticateUser)
app.get('/secrets', (req, res) => {
  res.json({ secret: 'This is a super secret message'})
})

app.get('/users/:userId', authenticateUser)
app.get('/users/:userId', (req, res) => {
  try {
    res.status(201).json(req.body.user)
  } catch (err) {
    res.status(400).json({ message: 'Could not find user', errors: err.errors })
  }
})

app.get('/users/messages', async (req, res) => {
  const {sort} = req.query

  const sortData = (sort) => {
    if (sort === 'dates') {
      return {createdAt: 'asc'}
    } else if (sort === 'likes') {
      return {likes: 'desc'}
    } else {
      return {createdAt: 'desc'}
    }
  }

  let messages = await Book.find().sort(sortData(sort)).limit(20).exec()
  res.json(messages)
})


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})




// Paste this code above and re-write it
// app.get('/', async (req, res) => {
//   const {sort} = req.query

//   const sortData = (sort) => {
//     if (sort === 'dates') {
//       return {createdAt: 'asc'}
//     } else if (sort === 'likes') {
//       return {likes: 'desc'}
//     } else {
//       return {createdAt: 'desc'}
//     }
//   }

//   let messages = await Book.find().sort(sortData(sort)).limit(20).exec()
//   res.json(messages)
// })

// Retrieve the information sent by the client to our API endpoint
// app.post('/', async (req, res) => {
//   const {message} = req.body
//   const book = new Book({message})

//   try {
//     const savedPost = await book.save()
//     res.status(201).json(savedPost)
//   } catch(err) {
//     res.status(400).json({message: 'Could not save post to the database', error: err.errors})
//   }
// })

// app.post('/:postLiked/like', async (req, res) => {
//   const {postId} = req.params
//   try {
//     await Book.updateOne({'_id': thoughtId}, {'$inc': {'likes': 1}})
//     res.status(201).json()
//   } catch (err) {
//     res.status(400).json({message: 'Could not find the post', error: err.errors})
//   }
// })

