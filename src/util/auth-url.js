const readline = require("readline");
const { OAuthError, ScopeError } = require("../classes/error.js");

/**
 * Generates a URL for obtaining an authorization code.
 * 
 * @param {Object} options The URL parameters.
 * @param {String} options.id The Application ID.
 * @param {String} options.redirect The Application redirect URI.
 * @param {String} [options.state=ruqqus-js] The Application state token.
 * @param {String[]|String} options.scopes The Application scopes. Either a string of values separated by commas or an array.
 * @param {Boolean} [options.permanent=true] Whether or not the Application will have permanent access to the account.
 * @returns {String} The generated URL.
 */

function getAuthURL(options) {
  let scopeList = [ "identity", "create", "read", "update", "delete", "vote", "guildmaster" ];
  let scopes;

  if (Array.isArray(options.scopes)) scopes = options.scopes;
  else if (typeof options.scopes == "string") {
    if (!options.scopes || options.scopes == " ") throw new ScopeError("Invalid scope list");

    try {
      if (options.scopes == "all") scopes = scopeList;
      else scopes = options.scopes.split(",");
    } catch (e) { 
      throw new ScopeError("Scope list must be split by commas"); 
    }
  } else throw new ScopeError("Scope list must be an array or a string");
  
  if (!options.id || options.id == " ") throw new OAuthError("Invalid application ID");
  
  scopes = scopes.filter(s => scopeList.includes(s.toLowerCase())).map(s => {
    return s.toLowerCase();
  });

  if (!options.redirect || options.redirect == " ") options.redirect = "http://localhost";

  return `https://${options.domain || 'ruqqus.com'}/oauth/authorize?client_id=${options.id}&redirect_uri=${options.redirect.startsWith("http") ? options.redirect : `${options.redirect}`}&state=${options.state || "ruqqus-js"}&scope=${scopes}${options.permanent ? "&permanent=true" : ""}`;
}

module.exports = { getAuthURL };
