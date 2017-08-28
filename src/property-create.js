const readline = require("readline");
const request = require("request");
const fs = require("fs");
const sleep = require('system-sleep');
const helper = require("./status.helper");
const apiFilePath = "./apikey.txt";

let EMAIL;
let TOKEN;
let APIKEY;
let ENV = {
  ATM_API_BASE: "https://api.adtechmedia.io/v1",
  ATM_WWW_BASE: "https://www.adtechmedia.io"
};

function rageQuit(error) {
  console.log("\x1b[31m%s\nProcess exit with code: %d\x1b[0m", error.msg, error.code);

  process.exit(error.code);
}

function sucessQuit(message) {
  console.log("\x1b[32m%s\x1b[0m", message);

  process.exit(2);
}

function log(message) {
  console.log("\x1b[33m%s\x1b[0m", message);
}

function errMsg(message) {
  console.log("\x1b[31m%s\x1b[0m", message);
}

function setEmail(email) {
  log(`Email was set to ${email}`);
  EMAIL = email;
  askENV(setEnv);
}

function setEnv(env) {
  if (!env || env === "PROD") {
    return;
  }

  ENV.ATM_API_BASE = `https://api-${env}.adtechmedia.io/v1`;
  ENV.ATM_WWW_BASE = `https://www-${env}.adtechmedia.io`;
  log(`Enviroment was set to ${env}`);
  checkIfApiValid(propertyCreate);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askEmail(cb) {
  if (process.argv[2]) {
    cb(process.argv[2]);
    return;
  }

  rl.question("Your Email? ", answer => {
    if (!answer) {
      rageQuit(helper.noEmail);
    }

    cb(answer);
  });
}

function askENV(cb) {
  if (process.argv[3]) {
    cb(process.argv[3].toLowerCase());
    return;
  }

  rl.question("Enviroment? ", answer => {
    if (!answer) {
      answer = "prod";
    }
    answer = answer.toLowerCase();

    cb(answer);
  });
}

function askToken() {
  rl.question("Token ( copy from email ): ", answer => {
    if (!answer) {
      rageQuit(helper.noToken);
    }

    setToken(answer);
  });
}

function propertyCreate() {
  log("Trying to create property. (It may take a while)");
  const DATA = `
  {
    "Name": "Generated Property - ${EMAIL}",
    "Website": "https://adtechmedia.io",
    "SupportEmail": "${EMAIL}",
    "Country": "USA",
    "ConfigDefaults": {
        "targetModal": {
            "targetCb": "function(modalNode, cb) { modalNode.mount(document.getElementById('#header'), modalNode.constructor.MOUNT_APPEND) }",
            "toggleCb": "function(cb) { cb(true) }"
        },
        "content": {
            "authorCb": "function(onReady) { onReady({fullName: 'Administrator', avatar: 'https://avatars.io/twitter/mitocgroup' }) }",
            "container": "main > article.story",
            "selector": "h3, p, div.paragraph, cite"
        }
    }
  }`;

  const options = {
    method: "PUT",
    url: `${ENV.ATM_API_BASE}/atm-admin/property/create`,
    body: DATA,
    headers: {
      "X-Api-Key": `${APIKEY}`,
      "Content-Type": "application/json"
    }
  };

  tryPropertyCreate(options, tryPropertyCreate);
}

function tryPropertyCreate(options, callback) {
  sleep(3500);
  request(options, (err, res, body) => {
    var response;
    try {
      responseError = JSON.parse(body).Message;
      response = JSON.parse(body).message;
      if (responseError !== undefined) {
        throw Error(responseError);
      }
    } catch (err) {
      if (err.toString().indexOf("SyntaxError") > -1) {
        rageQuit(helper.propertySyntaxErr);
      }
      log("Invalid apikey creating new one!");
      sendToken(askToken);
      return;
    }

    if (err) {
      rageQuit(helper.runtimeErr(err));
    }

    if (response === "Forbidden") {
      errMsg("Property Create failed, retrying!");
      callback(options, tryPropertyCreate);
    } else {
      sucessQuit("Property has been successfully created!");
    }
  });
}

function checkIfApiValid(cb) {
  log("Checking if saved API is valid");
  fs.readFile(apiFilePath, function read(err, data) {
    if (err) {
      log("Invalid apikey creating new one!");
      sendToken(askToken);
    } else {
      textData = data.toString("utf8").split("|");
      
      try {
        const err = JSON.parse(textData);
        fs.unlink(apiFilePath);
        log("Invalid apikey creating new one!");
        sendToken(askToken);
      } catch (e) {
        if (textData[0].length < 10) {
          sendToken(askToken);
        } else {
          APIKEY = textData[0];
          if(textData[1].toString() !== EMAIL.toString()){
            log(`Email you provide (${EMAIL}) doesnt match to email saved (${textData[1]})`);

            rl.question("Want to use old email? (Y/N): ", answer => {
              if (!answer) {
                rageQuit(helper.noEmail);
              }

              if(answer.toLowerCase() === 'y' || answer.toLowerCase() === "yes") {
                EMAIL = textData[1].toString();
                log(`Email set back to ${EMAIL}`);
                checkIfApiValid(cb);
              } else {
                log('Reset email');
                fs.unlink(apiFilePath, function() {
                  checkIfApiValid(cb);
                })
              }
            });

            return;
          }

          cb();
        }
      }
    }
  });
}

function setToken(token) {
  TOKEN = token;

  log(`Token was set to ${token}`);
  tokenExchange(setApi);
}

function sendToken(cb) {
  log("Sending token");

  const DATA = JSON.parse(`
  { 
    "Email" : "${EMAIL}", 
    "LinkTpl": "Your token: %tmp-token%" 
  }`);

  const options = {
    method: "PUT",
    url: `${ENV.ATM_API_BASE}/deep-account/client/token-send`,
    body: DATA,
    json: true,
    headers: {
      "Content-Type": "application/json"
    }
  };

  request(options, (err, res, body) => {
    if (err) {
      rageQuit(helper.runtimeErr(err));
    }

    textBody = body.toString("utf8");

    try {
      const err = JSON.parse(res.body.errorMessage).errorMessage;
      rageQuit(helper.runtimeErr(err));
    } catch (e) {
      // no error found
      try {
        const err = JSON.parse(textBody);
        rageQuit(helper.runtimeErr(textBody.errorMessage));
      } catch (e) {
        cb();
      }
    }
  });
}

function tokenExchange(cb) {
  log("Exchanging token");
  var qsOptions = {
    Email: EMAIL,
    TempToken: TOKEN
  };

  const options = {
    method: "GET",
    url: `${ENV.ATM_API_BASE}/deep-account/client/token-exchange`,
    qs: qsOptions
  };

  request(options, (err, res, body) => {
    if (err) {
      rageQuit(helper.runtimeErr(err));
    }

    try {
      let msg = JSON.parse(body).message;
      if (msg !== undefined || JSON.parse(body).apiKey === undefined) {
        rageQuit(helper.tokenExpired);
      } else {
        cb(JSON.parse(body).apiKey, propertyCreate);
      }
    } catch (e) {
      cb(JSON.parse(body).apiKey, propertyCreate);
    }
  });
}

function setApi(apiKey, cb) {
  APIKEY = apiKey;
  log(`ApiKey was set to ${apiKey}`);
  write(`${apiKey}|${EMAIL}`);
  cb();
}

askEmail(setEmail);

function write(buffer) {
  fs.truncate(apiFilePath, 0, function() {
    fs.writeFileSync(apiFilePath, buffer);
  });
}
