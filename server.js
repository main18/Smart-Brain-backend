import express, { response } from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import cors from "cors";
import knex from "knex";
import Clarifai from "clarifai";
const saltRounds = 10;

// the API key
const API = new Clarifai.App({
  apiKey: "f35a45f4dee64f27b5c2dafc7e75d4ab",
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = knex({
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  },
});

// Root route
app.get("/", (req, res) => {
  res.send("it's working!");
});

// Signin route
app.post("/signin", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json("incorrect from submission");
  }
  db("users")
    .select("email", "hash")
    .from("login")
    .where("email", "=", email)
    .then((data) => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        db.select("*")
          .from("users")
          .where("email", "=", email)
          .then((user) => {
            res.json(user[0]);
          })
          .catch((err) => res.status(400).json("unable to get users"));
      } else {
        res.status(400).json("Wrong credentials");
      }
    })
    .catch((err) => res.status(400).json("Wrong credentials"));
});

// Register route
app.post("/register", (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json("incorrect from submission");
  }
  const hash = bcrypt.hashSync(password, saltRounds);
  db.transaction((trx) => {
    trx
      .insert({
        hash: hash,
        email: email,
      })
      .into("login")
      .returning("email")
      .then((loginEmail) => {
        return db("users")
          .returning("*")
          .insert({
            email: loginEmail[0],
            name: name,
            joined: new Date(),
          })
          .then((user) => {
            res.json(user[0]);
          });
      })
      .then(trx.commit)
      .catch(trx.rollback);
  }).catch((err) => res.status(400).json("unable to join"));
});

// Profile route
app.get("/profile/:id", (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json("incorrect from submission");
  }
  db.select("*")
    .from("users")
    .where({ id })
    .then((user) => {
      if (user.length) {
        res.json(user[0]);
      } else {
        res.status(400).json("Not Found!");
      }
    })
    .catch((err) => {
      res.status(400).json("error getting user!");
    });
});

// getting the api to the frontend
app.post("/imageurl", (req, res) => {
  API.models
    .predict(Clarifai.FACE_DETECT_MODEL, req.body.input)
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      res.status(400).json("unable to work with API");
    });
});

// Updating the entries for a specifc user
app.put("/image", (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json("incorrect from submission");
  }
  db("users")
    .where("id", "=", id)
    .increment("entries", 1)
    .returning("entries")
    .then((entries) => {
      res.json(entries[0]);
    })
    .catch((err) => res.status(400).json("unable to get entries"));
});

// Setting up the port
app.listen(process.env.PORT, () => {
  console.log("App is running on port", process.env.PORT);
});
