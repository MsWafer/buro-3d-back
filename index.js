var express = require("express");
const connectDB = require("./middleware/db");
const cors = require("cors");

const app = express();
connectDB();

app.use(express.json({ extended: false }));
app.use(cors());
app.use(express.static("public"));

app.get("/", (req, res) => res.send("no hack plz"));

app.use("/auth", require("./routes/auth"));
app.use("/up",require("./routes/modelder"))

const PORT = process.env.PORT || 7770;

app.listen(PORT, () => console.log(`Server started on ${PORT}`));
