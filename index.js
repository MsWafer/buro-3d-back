var express = require("express");
var Axios = require("axios");
var bodyParser = require("body-parser");
const connectDB = require("./middleware/db");
const cors = require("cors");
var multer = require("multer");
var upload = multer({
  dest: "/usr/src/app/tmp",
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype == "application/octet-stream"
    ) {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error("Разрешенны только .jpg, .png, .jpeg"));
    }
  },
});
const onLaunch = require("./middleware/onLaunch");
const Project = require("./models/Project");
const Sprint = require("./models/Sprint");
const app = express();
connectDB();

app.use(express.json({ extended: false }));
app.use(cors());
app.use(express.static("tmp"));

app.get("/", (req, res) => res.send("no hack plz"));

app.use("/auth", require("./routes/auth"));

const PORT = process.env.PORT || 7770;

app.listen(PORT, () => console.log(`Server started on ${PORT}`));

var FORGE_CLIENT_ID = process.env.FORGE_CLIENT_ID;
var FORGE_CLIENT_SECRET = process.env.FORGE_CLIENT_SECRET;
var scopes = "data:read data:write data:create bucket:create bucket:read";
const bucketKey = FORGE_CLIENT_ID.toLowerCase() + "_3dburo_bucket";
process.env.bucketKey = bucketKey;
const policyKey = "temporary";
var Buffer = require("buffer").Buffer;
String.prototype.toBase64 = function () {
  return new Buffer(this).toString("base64");
};
var fs = require("fs");
const ooa = require("./middleware/ooa");

let launchFetches = (req, res) => {
  onLaunch(
    FORGE_CLIENT_ID,
    FORGE_CLIENT_SECRET,
    scopes,
    bucketKey,
    policyKey,
    res
  );
};
launchFetches();

//post file
app.post("/upload", upload.single("file"), async (req, res) => {
  await ooa(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, scopes);
  fs.readFile(req.file.path, async (err, filecontent) => {
    Axios({
      method: "PUT",
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      url:
        "https://developer.api.autodesk.com/oss/v2/buckets/" +
        encodeURIComponent(bucketKey) +
        "/objects/" +
        encodeURIComponent(req.file.originalname),
      headers: {
        Authorization: "Bearer " + process.env.access_token,
        "Content-Disposition": req.file.originalname,
        "Content-Length": filecontent.length,
      },
      data: filecontent,
    })
      .then(async (response) => {
        console.log(response);
        var urn = response.data.objectId.toBase64();
        await Project.findOneAndUpdate(
          { crypt: req.body.crypt },
          { $set: { urn: urn } }
        );
        await Sprint.findOneAndUpdate(
          { _id: req.body.sprintId },
          { $set: { urn: urn } }
        );
        res.json({ msg: "Файл загружен" });
      })
      .catch(function (error) {
        console.log(error);
        res.send("Failed to create a new object in the bucket");
      });
  });
});

//post file
app.post("/uploadprj", upload.single("file"), async (req, res) => {
  await ooa(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, scopes);
  fs.readFile(req.file.path, async (err, filecontent) => {
    Axios({
      method: "PUT",
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      url:
        "https://developer.api.autodesk.com/oss/v2/buckets/" +
        encodeURIComponent(bucketKey) +
        "/objects/" +
        encodeURIComponent(req.file.originalname),
      headers: {
        Authorization: "Bearer " + process.env.access_token,
        "Content-Disposition": req.file.originalname,
        "Content-Length": filecontent.length,
      },
      data: filecontent,
    })
      .then(async (response) => {
        console.log(response);
        var urn = response.data.objectId.toBase64();
        await Project.findOneAndUpdate(
          { crypt: req.body.crypt },
          { $set: { urn: urn } }
        );
        res.json({ msg: "Файл загружен" });
      })
      .catch(function (error) {
        console.log(error);
        res.send("Failed to create a new object in the bucket");
      });
  });
});

//token govna ebuchiy s urnoy i govnom proekta
app.get('/tokengovna/:crypt', async(req,res)=>{
  await ooa(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, scopes);
  let project = await Project.findOne({crypt:req.params.crypt})
  if(!project){return res.status(404).json({err:"Проект не найден"})}
  return res.json({urn:project.urn,
  token:process.env.access_token,
msg:'токен высрался'})
})

//token govna ebuchiy s urnoy i govnom sprinta
app.get('/tokengovna/:id', async(req,res)=>{
  await ooa(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, scopes);
  let sprint = await Sprint.findOne({_id:req.params.id})
  if(!sprint){return res.status(404).json({err:"Спринт не найден"})}
  return res.json({urn:sprint.urn,
  token:process.env.access_token,
msg:'токен высрался'})
})
