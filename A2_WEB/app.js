const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");
const linebyline = require("linebyline");
const session = require("client-sessions");
const randomStr = require("randomstring");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// for my cons isali
const DEFAULT_IMAGE = "isali.png";
const DEFAULT_BASE = "isali";
const USER_FILE = path.join(__dirname, "data", "user.json");

// Middleware- inportant
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.engine(
  ".hbs",
  exphbs.engine({
    extname: ".hbs",
    defaultLayout: false,
  }),
);
app.set("view engine", ".hbs");
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    cookieName: "MySession",
    secret: randomStr.generate(),
    duration: 30 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,
    httpOnly: true,
    secure: false,
    ephemeral: true,
  }),
);

// here my helper functions

function loadUsers() 
{
  return JSON.parse(fs.readFileSync(USER_FILE, "utf8"));
}

function saveUsers(users) 
{
  fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2), "utf8");
}

function stripBOM(s) 
{
  return s.replace(/^\uFEFF/, "");
}

function prettyLabel(filename) 
{
  const base = path.parse(filename).name.replace(/[_-]+/g, " ").trim();
  return base
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function readImageList() 
{
  return new Promise((resolve, reject) => {
    const rl = linebyline(path.join(__dirname, "imagelist.txt"));
    const images = [];

    rl.on("line", line => {
      const raw = stripBOM(String(line)).trim();
      if (!raw) return;

      const baseLower = path.parse(raw).name.toLowerCase();
      if (baseLower === DEFAULT_BASE) return;

      const parsed = path.parse(raw);
      const file = parsed.ext ? raw : `${raw}.png`;

      images.push({
        file,
        label: prettyLabel(file),
      });
    });

    rl.on("error", reject);
    rl.on("end", () => resolve(images));
  });
}

// here my home -> login
app.get("/", (req, res) => {
  res.redirect("/login");
});

// my login
app.get("/login", (req, res) => {
  if (req.MySession.user) return res.redirect("/gallery");

  res.render("login", {
    success: req.query.success || "",
  });
});

// my login submit
app.post("/login", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const users = loadUsers();

  if (!username || !password) {
    return res.render("login", {
      error: "Please enter username and password",
    });
  }

  if (!users[username]) {
    return res.render("login", {
      error: "Not a registered username",
    });
  }

  if (users[username] !== password) {
    return res.render("login", {
      error: "Invalid password",
    });
  }

  req.MySession.user = username;
  res.redirect("/gallery");
});

// my register page
app.get("/register", (req, res) => {
  if (req.MySession.user) return res.redirect("/gallery");
  res.render("register");
});

// my register submit
app.post("/register", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;

  const users = loadUsers();

  if (!email || !password || !confirmPassword) {
    return res.render("register", {
      error: "Please fill in all fields",
    });
  }

  if (users[email]) {
    return res.render("register", {
      error: "Email already registered",
    });
  }

  if (password !== confirmPassword) {
    return res.render("register", {
      error: "Passwords do not match",
    });
  }

  users[email] = password;
  saveUsers(users);

  res.redirect("/login?success=Registration successful. Please log in.");
});

// my logout
app.get("/logout", (req, res) => {
  req.MySession.reset();
  res.redirect("/login");
});

// my gallery page
app.get("/gallery", async (req, res) => {
  if (!req.MySession.user) return res.redirect("/login");

  const images = await readImageList();

  res.render("index", {
    title: "Turkey at a Glance",
    images,
    selectedImage: DEFAULT_IMAGE,
    caption: "Isali",
    username: req.MySession.user,
  });
});

// my gallery submit
app.post("/gallery", async (req, res) => {
  if (!req.MySession.user) return res.redirect("/login");

  const images = await readImageList();
  const chosen = req.body.image;

  let selectedImage = DEFAULT_IMAGE;
  let caption = "Isali";

  if (chosen) {
    const found = images.find(i => i.file === chosen);
    if (found) {
      selectedImage = found.file;
      caption = found.label;
    }
  }

  res.render("index", {
    title: "Turkey at a Glance",
    images,
    selectedImage,
    caption,
    username: req.MySession.user,
  });
});

// here for my start server
module.exports = app;
