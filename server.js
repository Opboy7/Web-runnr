const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const { Parser } = require("json2csv");

const app = express();
const db = new sqlite3.Database("bookings.db");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({ secret: "cartravelssecret", resave: false, saveUninitialized: true }));

// Create bookings table if not exists
db.run(`CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, phone TEXT, email TEXT, pickup TEXT, drop_loc TEXT,
  date TEXT, car TEXT, message TEXT
)`);

// ===== Customer Booking =====
app.post("/book", (req, res) => {
  const { name, phone, email, pickup, drop, date, car, message } = req.body;

  db.run(
    `INSERT INTO bookings (name, phone, email, pickup, drop_loc, date, car, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, phone, email, pickup, drop, date, car, message],
    (err) => {
      if (err) return res.send("❌ Error saving booking");
      res.redirect("/success");
    }
  );
});

app.get("/success", (req, res) => {
  res.sendFile(__dirname + "/public/success.html");
});

// ===== Admin Login =====
app.get("/login", (req, res) => {
  res.send(`
    <form method="POST" action="/login" style="margin:50px;text-align:center;">
      <h2>Admin Login</h2>
      <input name="username" placeholder="Username" required>
      <input name="password" type="password" placeholder="Password" required>
      <button type="submit">Login</button>
    </form>
  `);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    req.session.loggedIn = true;
    res.redirect("/admin");
  } else res.send("❌ Invalid credentials");
});

// ===== Admin Panel =====
app.get("/admin", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");

  const { filterDate } = req.query;
  let sql = `SELECT * FROM bookings`;
  let params = [];
  if (filterDate) { sql += ` WHERE date = ?`; params.push(filterDate); }
  sql += ` ORDER BY id DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.send("❌ Error loading bookings");

    let html = `
      <!DOCTYPE html>
      <html lang="en" data-bs-theme="light">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Panel - Car Travels</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body class="bg-light">
        <div class="container py-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h1 class="h3">📋 Admin Panel</h1>
            <div class="d-flex gap-2">
              <button id="themeBtn" class="btn btn-outline-secondary btn-sm">🌙 Dark Mode</button>
              <a href="/logout" class="btn btn-danger btn-sm">🚪 Logout</a>
              <a href="/export" class="btn btn-success btn-sm">⬇️ Export CSV</a>
            </div>
          </div>

          <form method="GET" action="/admin" class="row g-2 mb-4">
            <div class="col-auto">
              <input type="date" name="filterDate" value="${filterDate || ""}" class="form-control">
            </div>
            <div class="col-auto">
              <button type="submit" class="btn btn-primary">Filter</button>
              <a href="/admin" class="btn btn-secondary">Reset</a>
            </div>
          </form>

          <div class="table-responsive">
            <table class="table table-bordered table-striped table-hover align-middle">
              <thead class="table-dark">
                <tr>
                  <th>ID</th><th>Name</th><th>Phone</th><th>Email</th>
                  <th>Pickup</th><th>Drop</th><th>Date</th>
                  <th>Car</th><th>Message</th><th>Action</th>
                </tr>
              </thead>
              <tbody>`;

    if (rows.length === 0) {
      html += `<tr><td colspan="10" class="text-center text-muted">No bookings found</td></tr>`;
    } else {
      rows.forEach(r => {
        html += `<tr>
          <td>${r.id}</td><td>${r.name}</td><td>${r.phone}</td><td>${r.email}</td>
          <td>${r.pickup}</td><td>${r.drop_loc}</td><td>${r.date}</td>
          <td>${r.car}</td><td>${r.message}</td>
          <td><a href="/delete/${r.id}" onclick="return confirm('❌ Delete booking ID ${r.id}?');" class="btn btn-sm btn-outline-danger">🗑️ Delete</a></td>
        </tr>`;
      });
    }

    html += `</tbody></table></div></div>

      <script>
        const themeBtn = document.getElementById("themeBtn");
        const htmlTag = document.documentElement;
        function setTheme(theme){
          htmlTag.setAttribute("data-bs-theme",theme);
          localStorage.setItem("theme",theme);
          themeBtn.innerText=theme==="dark"?"☀️ Light Mode":"🌙 Dark Mode";
        }
        if(localStorage.getItem("theme")) setTheme(localStorage.getItem("theme"));
        themeBtn.addEventListener("click",()=>setTheme(htmlTag.getAttribute("data-bs-theme")==="light"?"dark":"light"));
      </script>

      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
      </body></html>
    `;

    res.send(html);
  });
});

// Delete Booking
app.get("/delete/:id", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.run("DELETE FROM bookings WHERE id=?", [req.params.id], () => res.redirect("/admin"));
});

// Export CSV
app.get("/export", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  db.all("SELECT * FROM bookings ORDER BY id DESC", [], (err, rows) => {
    const fields = ["id","name","phone","email","pickup","drop_loc","date","car","message"];
    const csv = new Parser({ fields }).parse(rows);
    res.header("Content-Type","text/csv");
    res.attachment("bookings.csv");
    res.send(csv);
  });
});

// Logout
app.get("/logout", (req,res)=>{req.session.destroy(); res.redirect("/login");});

app.listen(3000,()=>console.log("🚀 Server running on port 3000"));
