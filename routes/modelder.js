const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({
  dest: "/usr/src/app/public",
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
const Axios = require("axios");

const Project = require("../models/Project");
const Sprint = require("../models/Sprint");
const { response } = require("express");
const { json } = require("body-parser");

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

//translate svf to obj
router.get("/objtr/:urn", async (req, res) => {
  try {
    let guid;
    let credentials;
    let objres;
    let auf = async () => {
      return await oAuth2TwoLegged.authenticate();
    };
    function flattenArray(data) {
      return data.reduce(function iter(r, a) {
        if (a === null) {
          return r;
        }
        if (Array.isArray(a)) {
          return a.reduce(iter, r);
        }
        if (typeof a === "object") {
          return Object.keys(a)
            .map((k) => a[k])
            .reduce(iter, r);
        }
        return r.concat(a);
      }, []);
    }
    function numbersOnly(value) {
      if (typeof value === "number") {
        return value;
      }
    }

    await auf().then((response) => (credentials = response));
    let token = credentials.access_token;
    await ManifestApi.getMetadata(
      req.params.urn,
      {},
      oAuth2TwoLegged,
      credentials
    ).then((response) => (guid = response.body.data.metadata[0].guid));
    const tree = await ManifestApi.getModelviewMetadata(
      req.params.urn,
      guid,
      {},
      oAuth2TwoLegged,
      credentials
    );
    let ids = flattenArray(tree.body.data.objects).filter(numbersOnly);

    Axios({
      method: "POST",
      url:
        "https://developer.api.autodesk.com/modelderivative/v2/designdata/job",
      headers: {
        "content-type": "application/json",
        Authorization: "Bearer " + token,
        "x-ads-force": true,
      },
      data: JSON.stringify({
        input: {
          urn: req.params.urn,
        },
        output: {
          destination: {
            region: "us",
          },
          formats: [
            {
              type: "obj",
              advanced: {
                modelGuid: guid,
                objectIds: ids,
              },
            },
          ],
        },
      }),
    }).then((govno) => (objres = govno.data), res.json(objres));
  } catch (error) {
    console.error(error);
    return res.json(error);
  }
});

//check obj manifest, if successfull download files to server and save to model
router.get("/objdl/:urn", async (req, res) => {
  let proj = await Project.findOne({urn:req.params.urn})
  if(!proj){return res.status(404).json({msg:'Неверная урна или урна не привязана к проекту'})}
  let credentials;
  let children;
  let auf = async () => {
    return await oAuth2TwoLegged.authenticate();
  };
  await auf().then((response) => (credentials = response));
  let token = credentials.access_token;
  await ManifestApi.getManifest(
    req.params.urn,
    {},
    oAuth2TwoLegged,
    credentials
  ).then((response) => (children = response.body.derivatives[2].children))
  .catch((error)=>console.log(error),res.status(500).json({msg:'server error'}));

  let mtl = children[children.length - 1];
  let obj = children[children.length - 2];
  let objFile = obj.urn.split("/").filter(Boolean).pop();
  let mtlFile = mtl.urn.split("/").filter(Boolean).pop();  

  if (obj.status != "success" || mtl.status != "success") {
    return res.json({ msg: "Ne gotovo", objStatus : obj.status, mtlStatus : mtl.status });
  }

  let objDownload = await Axios({
    method: "GET",
    url: `https://developer.api.autodesk.com/modelderivative/v2/designdata/${req.params.urn}/manifest/${obj.urn}`,
    headers: {
      Authorization: "Bearer " + token,
    },
  });
  fs.writeFile(
    `${__dirname + "/../public/" + objFile}`,
    objDownload.data,
    (err) => {
      if (err) throw err;
    }
  );
  let mtlDownload = await Axios({
    method: "GET",
    url: `https://developer.api.autodesk.com/modelderivative/v2/designdata/${req.params.urn}/manifest/${mtl.urn}`,
    headers: {
      Authorization: "Bearer " + token,
    },
  });
  fs.writeFile(
    `${__dirname + "/../public/" + mtlFile}`,
    mtlDownload.data,
    (err) => {
      if (err) throw err;
    }
  );

  proj.obj = objFile;
  proj.mtl = mtlFile;
  await proj.save()

  res.json({obj:objFile,mtl:mtlFile});
});

//create bucket
router.post("/bucket", async (req, res) => {
  try {
    BucketsApi.createBucket(
      {
        bucketKey: FORGE_CLIENT_ID.toLowerCase() + "_buro_rvt_bucket",
        policyKey: "persistent",
      },
      {},
      oAuth2TwoLegged,
      await oAuth2TwoLegged.authenticate()
    )
      .then((response) => {
        console.log(response);
      })
      .catch((error) => {
        console.log(error);
      });
  } catch (error) {
    console.error(error);
  }
});

//get token+prj
router.get("/tkn/p/:crypt", async (req, res) => {
  try {
    let prj = await Project.findOne({ crypt: req.params.crypt });
    if (!prj) {
      return res.status(404).json({ err: "Проект не найден" });
    }
    oAuth2TwoLegged.authenticate().then((response) => {
      return res.json({
        token: response.access_token,
        urn: prj.urn,
      });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ err: "server error" });
  }
});

//get token+spr
router.get("/tkn/s/:id", async (req, res) => {
  try {
    let spr = await Sprint.findOne({ _id: req.params.id });
    if (!spr) {
      return res.status(404).json({ err: "Спринт не найден" });
    }
    oAuth2TwoLegged.authenticate().then((response) => {
      return res.json({
        token: response.access_token,
        urn: spr.urn,
      });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ err: "server error" });
  }
});

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
        let prj = await Project.findOne({ crypt: req.body.crypt })
          .populate("sprints")
          .populate("team");
        res.json({ msg: "Файл загружен, переводим.....", project: prj });
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
router.get("/status/p/:crypt", async (req, res) => {
  let project = await Project.findOne({ crypt: req.params.crypt });
  if (!project) {
    return res.json({ err: "Проект не найден" });
  }
  if (!project.urn) {
    return res.json({ progress: "Модель загружается" });
  }
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
    res.json();
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
        let spr = await Sprint.findOne({ _id: req.body.id });
        res.json({ msg: "Файл загружен, переводим.....", sprint: spr });
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
router.get("/status/s/:id", async (req, res) => {
  let sprint = await Sprint.findOne({ _id: req.params.id });
  if (!sprint) {
    return res.json({ err: "Спринт не найден" });
  }
  if (!sprint.urn) {
    return res.json({ progress: "Модель загружается" });
  }
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
