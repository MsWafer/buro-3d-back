var Axios = require("axios");
const querystring = require("querystring");

module.exports = (
  FORGE_CLIENT_ID,
  FORGE_CLIENT_SECRET,
  scopes
  ) => {
  Axios({
    method: "POST",
    url: "https://developer.api.autodesk.com/authentication/v1/authenticate",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    data: querystring.stringify({
      client_id: FORGE_CLIENT_ID,
      client_secret: FORGE_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: scopes,
    }),
  })
    .then((response) => {
      process.env.access_token = response.data.access_token;
    //   console.log(response);
      // res.redirect("/api/forge/datamanagement/bucket/create");
    })
    .catch((error) => {
      console.log(error);
      res.send("Failed to authenticate");
    });
};
