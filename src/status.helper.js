module.exports = {
  runtimeErr: err => {
    return {
      msg: err,
      code: 1
    };
  },
  noEmail: {
    msg: "You should introduce your email!",
    code: 2
  },
  noToken: {
    msg: "No token provided!",
    code: 3
  },
  tokenExpired: {
    msg: "Could not extract api key, maybe token is expired!",
    code: 4
  },
  propertySyntaxErr: {
    msg:
      "Property create failed!\nMost possible you dont have internet connection or Enviroment doesnt exist?!",
    code: 5
  }
};
