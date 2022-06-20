// IMPORT MODULES
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const fs = require("fs");
const _ = require("lodash");
const multer = require("multer");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const PORT = process.env.PORT || 3000;
// INITIALIZE APP
const app = express();

// MIDDLEWARE
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// VIEWS
app.set("view engine", "ejs");

// DATABASE CONNECTION
mongoose.connect(
  process.env.DBURL,
  {
    useUnifiedTopology: true,
  },
  () => {
    console.log("Connected to database");
  }
);
//  CREATE USER SCHEMA
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("User", userSchema);
// CREATE HOMEWORK SCHEMA
const homeworkSchema = new mongoose.Schema({
  title: String,
  summary: String,
  image: {
    data: Buffer,
    contentType: String,
  },
  user: String,
  comment: [
    {
      user: String,
      comment: String,
    }
  ]
});

const Homework = new mongoose.model("Homework", homeworkSchema);

// SETTING UP SESSION
app.use(
  session({
    secret: process.env.SESSIONSECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// PASSPORT CONFIGURATION
app.use(passport.initialize());
app.use(passport.session());
passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

// SET STORAGE
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now());
  },
});

var upload = multer({ storage: storage });

// ROUTES
// VIEW POST AND COMMMENTS
app.get("/viewPost/:post", (req, res) => {
  const requestedPostTitle = req.params.post;
  console.log(requestedPostTitle);
  Homework.findOne({ title: requestedPostTitle }, (err, post) => {
    if (err) {
      console.log(err);
    } else {
      res.render("viewPost", {
       title: post.title,
        summary: post.summary,
        image: post.image,
        // COMMENT
        comments: post.comment,

      });
    }
  });
})

app.post("/viewPost/:post", (req, res) => {
  // ADD COMMENT
 if(req.isAuthenticated()){
  const requestedPostTitle = req.params.post;
  const comment = req.body.comment;
  const user = req.user.username;
  Homework.findOne({ title: requestedPostTitle }, (err, post) => {
    if (err) {
      console.log(err);
    } else {
      post.comment.push({
        user: user,
        comment: comment,
      });
      post.save();
      console.log(post);
      res.redirect("/viewPost/" + requestedPostTitle);
    }
  });
}
})

// SUBMIT HOMEWORk
app.get("/submitHomeWork", (req, res) => {
// CHECK IF USER IS AUTHENTICATED
  if (req.isAuthenticated()) {
    res.render("submitHomeWork");
  } else {
    res.redirect("/login");
  }
});

app.post("/submitHomeWork", upload.single("image"), (req, res) => {
  // CHECK IF USER IS AUTHENTICATED
  if (req.isAuthenticated()) {
    console.log(req.user.username);
    const img = fs.readFileSync(req.file.path);
    const encode_img = img.toString("base64");
    const finalImg = {
      contentType: req.file.mimetype,
      image: new Buffer.from(encode_img, "base64"),
    };
    const newHomework = new Homework({
      title: req.body.title,
      summary: req.body.username,
      image: {
        data: finalImg.image,
        contentType: finalImg.contentType,
      },
      user: req.user.username,
    });
    newHomework.save().then(() => {
      res.redirect("/home");
      console.log("Homework submitted");
    });
  } else {
    res.redirect("/login");
  }
});

// LOGIN
app.get("/login", (req, res) => {
  res.render("login");
});
app.post("/login", (req, res) => {
  // LOGIN USER USING MONGOOSE PASSPORT
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(user, (err) => {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/home");
        console.log(user);
        console.log(req.body.username);
        console.log("Logged in");
      });
    }
  });
});
// REGISTER
app.get("/register", (req, res) => {
  res.render("register");
});
app.post("/register", (req, res) => {
  // REGISTER USER USING MONGOOSE PASSPORT
  User.register(
    { username: req.body.username },
    req.body.password,
    (err, user) => {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/home");
        });
        console.log(user);
        console.log("User registered");
        console.log(req.body.username);
      }
    }
  );
});

// HOME PAGE
app.get("/home", (req, res) => {
  // GET ALL HOMEWORKS FROM MONGOOSE
  Homework.find({}, (err, allHomework) => {
    if (err) {
      console.log(err);
    } else {
      // CONSOLE LOG THE SUMMARY IN HOMEWORKS
      console.log(allHomework.summary);
      res.render("home", { allHomework: allHomework });
    }
  });
});

// LANDING PAGE
app.get("/", (req, res) => {
  res.render("landingPage");
});

//  APP LISTEN
app.listen(PORT, () => {
  console.log(`Server is listening on port 3000`);
});
