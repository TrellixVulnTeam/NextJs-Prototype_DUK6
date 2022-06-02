const express = require("express");
const app = express();
const { connection } = require("./mysql");
const path = require("path");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs/dist/bcrypt");
const formidable = require("formidable");
const fs = require("fs-extra");

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "*");
  next();
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
const { getToken, verifyToken } = require("./jwtHandler");

app.get("/", function (req, res) {
  res.json("success");
});

app.post("/register", async function (req, res) {
  var hashedPassword = bcrypt.hashSync(req.body.password, 8);
  var password = hashedPassword;
  await connection.query(
    "INSERT INTO user (username, password, fullname) VALUES (?, ?, ?)",
    [req.body.username, password, req.body.fullname]
  );
  res.json("success");
});

app.post("/login", async function (req, res) {
  var username = req.body.username;
  const [user, result] = await connection.query(
    `SELECT * FROM user WHERE username = '${username}'`
  );
  var passwordIsValid = bcrypt.compareSync(req.body.password, user[0].password);
  if (passwordIsValid) {
    var token = getToken({ user_id: user.user_id, username: user.username });
    res.json({ status: "success", token: token });
  } else {
    res.json("Failed!");
  }
});

app.get("/feed", verifyToken, function (req, res) {
  res.json("success");
});

app.post("/uploads", (req, res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (error, fields, files) => {
    console.log(files);
    var newname = Date.now();
    var oldpath = files.userfile.filepath;

    var newpath =
      __dirname +
      "/upload/" +
      newname.toString() +
      "." +
      files.userfile.originalFilename.split(".").pop();

    fs.move(oldpath, newpath, function (err) {
      res.json({ result: "Upload Successfully", account: fields });
    });
  });
});

app.post("/api/admin/login", async function (req, res) {
  var username = req.body.username;
  const [user, result] = await connection.query(
    `SELECT * FROM user WHERE username = '${username}'`
  );

  var passwordIsValid = bcrypt.compareSync(req.body.password, user[0].password);
  if (passwordIsValid) {
    var token = getToken({
      user_id: user[0].user_id,
      username: user[0].username,
    });

    res.json({
      status: "success",
      data: {
        token: token,
        user_id: user[0].user_id,
        username: user[0].username,
        fullname: user[0].fullname,
      },
    });
  } else {
    res.json("Failed!");
  }
});

app.post("/api/admin/register", async function (req, res) {
  var hashedPassword = bcrypt.hashSync(req.body.password, 8);
  var password = hashedPassword;
  await connection.query(
    "INSERT INTO user (username, password, fullname) VALUES (?, ?, ?)",
    [req.body.username, password, req.body.fullname]
  );
  res.json("success");
});

app.get("/api/admin/profile", verifyToken, async (req, res) => {
  const { user_id, username, token } = req;
  const [user, result] = await connection.query(
    `SELECT * FROM user WHERE user_id = '${user_id}'`
  );

  res.json({
    status: "success",
    data: {
      user_id: user[0].user_id,
      username: user[0].username,
      fullname: user[0].fullname,
      token: token,
    },
  });
});

app.get("/api/image/:image_path/:img_name", function (req, res) {
  var img_name = req.params.img_name;
  var image_path = req.params.image_path;
  var filepath = __dirname + "/upload/" + image_path + "/" + img_name;
  res.sendFile(filepath);
});

app.get("/api/admin/banner", verifyToken, async (req, res) => {
  const [data, result] = await connection.query(
    `SELECT * FROM banner ORDER BY arr ASC`
  );
  res.json({
    status: "success",
    data: data,
  });
});

app.get("/api/admin/banner/search", verifyToken, async (req, res) => {
  const { keyword } = req.query;
  const [data, result] = await connection.query(
    `SELECT * FROM banner WHERE banner_name LIKE '%${keyword}%'
     OR post_date LIKE '%${keyword}%'
     OR status LIKE '%${keyword}%' 
     OR created_at LIKE '%${keyword}%' 
     ORDER BY arr ASC`
  );
  res.json({
    status: "success",
    data: data,
  });
});

app.post("/api/admin/banner/add", verifyToken, (req, res) => {
  fields = req.body.fields;
  files = req.body.files;

  const banner_name = fields.banner_name;
  const post_date = fields.post_date;
  const status = fields.status;
  const { user_id } = req;
  var newname = Date.now();
  var oldpath = files.banner.filepath;
  var extension = files.banner.originalFilename.split(".").pop().toLowerCase();
  var original_name =
    files.banner.originalFilename.split(".")[0] + "." + extension;
  var newpath =
    __dirname + "/upload/banner/" + newname.toString() + "." + extension;
  const banner = newname.toString() + "." + extension;

  fs.move(oldpath, newpath, async function (err) {
    const [result] = await connection.query(
      "SELECT MAX(arr) AS 'arr' FROM banner"
    );
    var arr = 0;
    if (result.length > 0) {
      arr = result[0].arr + 1;
    }
    await connection.query(
      `INSERT INTO banner (banner_name, post_date, original_name, banner, status, user_id, arr) VALUES ("${banner_name}", "${post_date}", "${original_name}", "${banner}", "${status}", "${user_id}", "${arr}")`
    );

    res.json({ status: "success" });
  });
});

app.delete("/api/admin/banner/delete", async (req, res) => {
  const { id } = req.query;
  await connection.query(`DELETE FROM banner WHERE banner_id = ${id}`);
  res.json({
    status: "success",
  });
});

app.post("/api/admin/banner/sortable", verifyToken, function (req, res) {
  var arr = req.body;
  arr.forEach(function (value, key) {
    connection.query("UPDATE banner SET arr=? WHERE banner_id = ?", [
      key,
      value.banner_id,
    ]);
  });
  res.json({
    status: "success",
  });
});

app.listen(3001, function () {
  console.log("listening on port : 3001");
});