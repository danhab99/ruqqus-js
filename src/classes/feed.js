const Client = require("./client.js");
const { OAuthError } = require("./error.js");
const Post = require('./post')

class Feed {
  constructor(data) {
    this._hasNext = data.next_exists
    Object.assign(this, Feed.formatData(data));
  }
  
  static formatData(resp) {
    return {
      posts: resp.data.map(d => new Post(d))
    }
  }  
}

module.exports = Feed;