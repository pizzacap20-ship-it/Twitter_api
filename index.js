let express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { DATABASE_URL } = process.env;
require("dotenv").config();

let app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function getPostgresVersion() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT version()");
    console.log(res.rows[0]);
  } finally {
    client.release();
  }
}

getPostgresVersion();

// Post a single posts with user_id
// I want to make a posts, that has user_id
app.post("/posts", async (req, res) => {
  const client = await pool.connect();
  const { title, content, user_id } = req.body;
  try {
    // check if user exists
    const userExists = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [user_id],
    );
    if (userExists.rows.length > 0) {
      // user exists, add post
      const post = await client.query(
        "INSERT INTO posts (title, content, user_id, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *",
        [title, content, user_id],
      );
      // send new data post back to the client
      res.json(post.rows[0]);
    } else {
      // user does not exist
      res.status(404).json({ error: "User does not exist" });
    }
  } catch (error) {
    console.error(error.stack);
    res.status(500).json({ error: "An error occurred, please try again." });
  } finally {
    client.release();
  }
});

// INSERT INTO likes (user_id, post_id, created_at)
// VALUES (1, 2, CURRENT_TIMESTAMP)
// post a single likes with user_id and post_id
app.post("/likes", async (req, res) => {
  const client = await pool.connect();
  const { user_id, post_id } = req.body;
  try {
    const newLike = await client.query(
      "INSERT INTO likes (user_id, post_id, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *",
      [user_id, post_id],
    );
    res.json(newLike.rows[0]);
  } catch (error) {
    console.error(error.stack);
    res.status(500).send("An error occurred, please try again.");
  } finally {
    client.release();
  }
});

// DELETE FROM likes WHERE id = 2
// delete a single like using id
app.delete("/likes/:id", async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;
  try {
    await client.query("DELETE FROM likes WHERE id = $1", [id]);
    res.json({ message: "like deleted successfully" });
  } catch (error) {
    console.error(error.stack);
    res.status(500).send("An error occurred, please try again.");
  } finally {
    client.release();
  }
});

// SELECT users.username
// FROM likes
// INNER JOIN users
// ON likes.user_id = users.id
// WHERE likes.post_id = 1
// get all the likes in a post using post_id
// transform result into an array of usernames
app.get("/likes/post/:post_id", async (req, res) => {
  const client = await pool.connect();
  const { post_id } = req.params;
  try {
    const likes = await client.query(
      "Select users.username FROM likes INNER JOIN users ON likes.user_id = users.id WHERE likes.post_id = $1",
      [post_id],
    );
    // array of string usernames
    const result = likes.rows.map((row) => row.username);
    res.json(result);
  } catch (error) {
    console.error(error.stack);
    res.status(500).send("An error occurred, please try again.");
  } finally {
    client.release();
  }
});

// UPDATE posts
// SET views = views + 1
// WHERE id = 1
// increment 1 view count every time it's accessed using id
app.get("/posts/:id", async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;
  try {
    const query = await client.query(
      "UPDATE posts SET views = views + 1 WHERE id = $1 RETURNING *",
      [id],
    );
    if (query.rowCount === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(query.rows[0]);
  } catch (error) {
    console.error(error.stack);
    res.status(500).send("An error occurred, please try again.");
  }
});

// INSERT INTO comment (user_id, post_id, content, created_at) VALUES
// (4, 3, 'cool this is sick!!!', CURRENT_TIMESTAMP)
// post a single comment with user_id and post_id and content
app.post("/comment", async (req, res) => {
  const client = await pool.connect();
  const { user_id, post_id, content } = req.body;
  try {
    const result = await client.query(
      "INSERT INTO comment (user_id, post_id, content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *",
      [user_id, post_id, content],
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error.stack);
    res.status(500).send("An error occurred, please try again.");
  } finally {
    client.release();
  }
});

// SELECT comment.id, users.username, comment.content, comment.created_at
// FROM comment
// JOIN users ON comment.user_id = users.id
// WHERE comment.post_id = 1
// get all the comment for a specific post, including id, content, users.username and timestamp
app.get("/comment/post/:id", async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;
  try {
    const result = await client.query(
      "SELECT comment.id, users.username, comment.content, comment.created_at FROM comment JOIN users ON comment.user_id = users.id WHERE comment.post_id = $1",
      [id],
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error.stack);
    res.status(500).send("An error occurred, please try again.");
  } finally {
    client.release();
  }
});

// UPDATE comment
// SET content = 'this is way better than cool!!!!'
// WHERE id = 1
// Edit the content of a comment
app.put("/comment/:id", async (req, res) => {
  const client = await pool.connect();
  const { content, id } = req.body;
  try {
    const result = await client.query(
      "UPDATE comment SET content = $1 WHERE id = $2 RETURNING *",
      [content, id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "id not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error.stack);
    res.status(500).send("An error occurred, please try again.");
  } finally {
    client.release();
  }
});

// DELETE FROM comment WHERE id = 3
// Delete a comment by its id
app.delete("/comment/:id", async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;
  try {
    const result = await client.query("DELETE FROM comment WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).send("comment not found");
    }
    res.json({ message: "Comment deleted successfully." });
  } catch (error) {
    console.error(error.stack);
    res.status(500).send("An error occurred, please try again.");
  } finally {
    client.release();
  }
});

// INSERT INTO comment_likes (comment_id, user_id)
// VALUES (1, 4)
// add a comment_like using comment_id and user_id
app.post("/comment/:id/like", async (req, res) => {
  const client = await pool.connect();
  const { comment_id, user_id } = req.body;
  try {
    const result = await client.query(
      "INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) RETURNING *",
      [comment_id, user_id],
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error.stack);
    res.status(500).send("An error occurred, please try again.");
  } finally {
    client.release();
  }
});

app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to the twitter API!" });
});

app.listen(3000, () => {
  console.log("App is listening on port 3000");
});
