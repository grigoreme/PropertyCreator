const readline = require('readline');
var request = require('request');
var fs = require('fs');
var sleep = require('sleep'); 

var fd;
var apiFilePath = './apikey.txt';

let EMAIL;
let TOKEN;
let APIKEY;
let ENV = {
  ATM_API_BASE: 'https://api.adtechmedia.io/v1',
  ATM_WWW_BASE: 'https://www.adtechmedia.io',
};

function rageQuit(message) {
  console.log('\x1b[31m%s\x1b[0m', message);

  process.exit(1);
}

function sucessQuit(message) {
  console.log('\x1b[32m%s\x1b[0m', message);

  process.exit(2);
}

function log(message) {
	console.log('\x1b[33m%s\x1b[0m', message);
}

function errMsg(message) {
	console.log('\x1b[31m%s\x1b[0m', message);
}

function setEmail(email) {
  log(`Email was set to ${email}`);
  EMAIL = email;
  askENV(setEnv);
}

function setEnv(env) {
  if(!env || env === 'PROD') {
    return;
  }

  ENV.ATM_API_BASE = `https://api-${env.toLowerCase()}.adtechmedia.io/v1`;
  ENV.ATM_WWW_BASE = `https://www-${env.toLowerCase()}.adtechmedia.io`;
  log(`Enviroment was set to ${env.toLowerCase()}`);
  checkIfApiValid(propertyCreate); 
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askEmail(cb) {
  if( process.argv[2] ) {
    cb(process.argv[2]);
    return;
  }
  

  rl.question('Your Email? ', (answer) => {
    if(!answer) {
      rageQuit('You should introduce your email!');
    }

    cb(answer);
  });
}

function askENV(cb) {
  if( process.argv[3] ) {
    cb(process.argv[3]);
    return;
  }

  rl.question('Enviroment? ', (answer) => {
    if(!answer) {
      answer = 'prod';
    }
    answer = answer.toUpperCase();

    cb(answer);
  });
}

function askToken() {
  rl.question('Token ( copy from email ): ', (answer) => {
    if(!answer) {
      rageQuit('No token provided!');
    }

    setToken(answer);
    rl.close();
  });
}

function propertyCreate() {
  log('Trying to create property. (It may take a while)');
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
    method: 'PUT',
    url: `${ENV.ATM_API_BASE}/atm-admin/property/create`,
    body: DATA,
    headers: {
      'X-Api-Key': `${APIKEY}`,
      'Content-Type': 'application/json',
    },
  }

  tryPropertyCreate(options, tryPropertyCreate);
}

function tryPropertyCreate(options, callback) {
  request(options, (err,res,body) => {
    response = JSON.parse(body).message;
    if(err){
      rageQuit(err);
    }

    if(response === 'Forbidden') {
      errMsg('Property Create failed, retrying!');
      callback(options, tryPropertyCreate);
    } else {
      sucessQuit('Property has been successfully created!'); 
    }
  });
}

function checkIfApiValid(cb) {
  log('Checking if saved API is valid');
  fs.readFile(apiFilePath, function read(err, data) {
    if (err) {
      log('Invalid apikey creating new one!');
      sendToken(askToken);
    } else {
      textData = data.toString('utf8');
      
      try {
        const err = JSON.parse(textData);
        fs.unlink(apiFilePath);
        log('Invalid apikey creating new one!');
        sendToken(askToken);
      } catch (e) {
        if (textData.length < 10) {
          sendToken(askToken);
        } else {
          APIKEY = textData;

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
  log('Sending token');
  
  const DATA = JSON.parse(`
  { 
    "Email" : "${EMAIL}", 
    "LinkTpl": "Your token: %tmp-token%" 
  }`);

  const options = {
    method: 'PUT',
    url: `${ENV.ATM_API_BASE}/deep-account/client/token-send`,
    body: DATA,
    json: true,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  request(options, (err,res,body) => {
    if(err){
      rageQuit(err);
    }

    textBody = body.toString('utf8');

    try {
      rageQuit(JSON.parse(res.body.errorMessage).errorMessage);
    } catch (e) {
      // no error found
      try {
        const err = JSON.parse(textBody);
        rageQuit(textBody.errorMessage);
      } catch (e) {
        cb();
      }
    }
  });
}

function tokenExchange(cb) {
  log('Exchanging token');
  var qsOptions = {
    Email: EMAIL,
    TempToken: TOKEN,
  }

  const options = {
    method: 'GET',
    url: `${ENV.ATM_API_BASE}/deep-account/client/token-exchange`,
    qs: qsOptions,
  }

  request(options, (err,res,body) => {
    if(err){
      rageQuit(err);
    }
    
    try {
      let msg = JSON.parse(body).message;
      if(msg !== undefined || JSON.parse(body).apiKey === undefined ) {
        rageQuit('Could not extract api key, maybe token is expired!');
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
  write(apiKey);
  cb();
}

askEmail(setEmail);

function write(buffer) {
	fs.truncate(apiFilePath, 0, function(){
		fs.writeFileSync(apiFilePath, buffer);
	})
}
