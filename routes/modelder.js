const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({
  dest: "/usr/src/app/tmp",
  fileFilter: (req, file, cb) => {
    if (file.mimetype == "application/octet-stream") {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error("Разрешенны только файлы говна"));
    }
  },
});
const ForgeSDK = require("forge-apis");
const BucketsApi = new ForgeSDK.BucketsApi();
const ManifestApi = new ForgeSDK.DerivativesApi(/*undefined, 'EU'*/);
const objectsApi = new ForgeSDK.ObjectsApi();
var Buffer = require("buffer").Buffer;
String.prototype.toBase64 = function () {
  return new Buffer(this).toString("base64");
};
const fs = require("fs");

const Project = require("../models/Project");
const Sprint = require("../models/Sprint");

var FORGE_CLIENT_ID = process.env.FORGE_CLIENT_ID;
var FORGE_CLIENT_SECRET = process.env.FORGE_CLIENT_SECRET;
const BUCKET_KEY = FORGE_CLIENT_ID.toLowerCase() + "_3dburo_bucket";
process.env.BUCKET_KEY = BUCKET_KEY;

var oAuth2TwoLegged = new ForgeSDK.AuthClientTwoLegged(
  FORGE_CLIENT_ID,
  FORGE_CLIENT_SECRET,
  [
    "data:read",
    "data:write",
    "data:search",
    "bucket:create",
    "bucket:read",
    "bucket:update",
    "viewables:read",
  ],
  true
);

//post file to project
router.post("/upload/p", upload.single("file"), async (req, res) => {
  let urn;
  fs.readFile(req.file.path, async (err, data) => {
    objectsApi
      .uploadObject(
        BUCKET_KEY,
        req.file.originalname,
        data.length,
        data,
        {},
        oAuth2TwoLegged,
        await oAuth2TwoLegged.authenticate()
      )
      .then(async (response) => {
        console.log(response);
        urn = response.body.objectId.toBase64();
        await Project.findOneAndUpdate(
          { crypt: req.body.crypt },
          { $set: { urn: urn } }
        );
        res.json({ msg: "Файл загружен, переводим....." });
        (async () => {
          ManifestApi.translate(
            {
              input: {
                urn: urn,
              },
              output: {
                formats: [
                  {
                    type: "svf",
                    views: ["2d", "3d"],
                  },
                ],
              },
            },
            {},
            oAuth2TwoLegged,
            await oAuth2TwoLegged.authenticate()
          ).then(
            (results) => {
              console.log(results.body);
            },
            function (err) {
              console.error(err);
            }
          );
        })();
      })
      .catch((error) => {
        console.log(error);
        return res.json({ msg: "НЕ ПОЛУЧИЛОСЬ" });
      });
  });
});

//check manifest status prj
router.get("/status/p", async (req, res) => {
  let project = await Project.findOne({ crypt: req.body.crypt });
  // return res.json(project.urn)
  ManifestApi.getManifest(
    project.urn,
    {},
    oAuth2TwoLegged,
    await oAuth2TwoLegged.authenticate()
  ).then(
    (buckets) => {
      console.log(buckets.body);
      return res.json({
        status: buckets.body.status,
        progress: buckets.body.progress,
      });
    },
    function (err) {
      console.error(err);
    }
  );
});


//post file to sprint
router.post("/upload/s", upload.single("file"), async (req, res) => {
    let urn;
    fs.readFile(req.file.path, async (err, data) => {
        res.json()
      objectsApi
        .uploadObject(
          BUCKET_KEY,
          req.file.originalname,
          data.length,
          data,
          {},
          oAuth2TwoLegged,
          await oAuth2TwoLegged.authenticate()
        )
        .then(async (response) => {
          console.log(response);
          urn = response.body.objectId.toBase64();
          await Project.findOneAndUpdate(
            { crypt: req.body.crypt },
            { $set: { urn: urn } }
          );
          await Sprint.findOneAndUpdate(
            { _id: req.body.id },
            { $set: { urn: urn } }
          );
          res.json({ msg: "Файл загружен, переводим....." });
          (async () => {
            ManifestApi.translate(
              {
                input: {
                  urn: urn,
                },
                output: {
                  formats: [
                    {
                      type: "svf",
                      views: ["2d", "3d"],
                    },
                  ],
                },
              },
              {},
              oAuth2TwoLegged,
              await oAuth2TwoLegged.authenticate()
            ).then(
              (results) => {
                console.log(results.body);
              },
              function (err) {
                console.error(err);
              }
            );
          })();
        })
        .catch((error) => {
          console.log(error);
          return res.json({ msg: "НЕ ПОЛУЧИЛОСЬ" });
        });
    });
  });
  
  //check manifest status spr
  router.get("/status/s", async (req, res) => {
    let sprint = await Sprint.findOne({ _id: req.body.id });
    ManifestApi.getManifest(
      sprint.urn,
      {},
      oAuth2TwoLegged,
      await oAuth2TwoLegged.authenticate()
    ).then(
      (buckets) => {
        console.log(buckets.body);
        return res.json({
          status: buckets.body.status,
          progress: buckets.body.progress,
        });
      },
      function (err) {
        console.error(err);
      }
    );
  });

module.exports = router;
