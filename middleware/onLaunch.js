var Axios = require("axios");
const querystring = require("querystring");
const ooa = require("./ooa");

module.exports = async (
  FORGE_CLIENT_ID,
  FORGE_CLIENT_SECRET,
  scopes,
  bucketKey,
  policyKey,
  res
) => {
  try {
    await ooa(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, scopes);
    await Axios({
      method: "POST",
      url: "https://developer.api.autodesk.com/authentication/v1/authenticate",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      data: querystring.stringify({
        client_id: FORGE_CLIENT_ID,
        client_secret: FORGE_CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "viewables:read",
      }),
    }).catch((error) => {
      console.log(error);
      // res.status(500).json(error);
    });

    //create bucket
    await Axios({
      method: "POST",
      url: "https://developer.api.autodesk.com/oss/v2/buckets",
      headers: {
        "content-type": "application/json",
        Authorization: "Bearer " + process.env.access_token,
      },
      data: JSON.stringify({
        bucketKey: bucketKey,
        policyKey: policyKey,
      }),
    })
      // .then((response) => console.log(response.json()))
      .then(()=>console.log('Bucket created.'))
      .catch((error) => {
        if (error.response && error.response.status == 409) {
          console.log("Bucket already exists, skip creation.");
          return;
          // res.redirect('/api/forge/datamanagement/bucket/detail');
        }
        console.log(error);
        // return res.json("Failed to create a new bucket");
      });
  } catch (error) {
    console.error(error);
    return res.json({ msg: "server error" });
  }
};
