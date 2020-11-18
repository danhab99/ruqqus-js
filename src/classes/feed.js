const { OAuthError } = require("./error.js");
const Post = require('./post')

class Feed {
  constructor(data, client) {
    this._hasNext = data.next_exists
    this.client = client
    Object.assign(this, this.formatData(data));
  }
  
  formatData(resp) {
    return {
      posts: resp.data.map(d => new Post(d, this.client))
    }
  }  
}

module.exports = Feed;