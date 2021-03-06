const { EventEmitter } = require("events");

const { GuildManager } = require("./guild.js");
const { PostManager } = require("./post.js");
const { CommentManager } = require("./comment.js");
const { User, BannedUser, DeletedUser, UserManager } = require("./user.js");

const APIRequest = require("../util/api-request.js");
const Config = require("../util/config.js");
const { ScopeError } = require("./error.js");

const Feed = require('./feed');
const Post = require("./post.js");

class Client extends EventEmitter {
  /**
   * Creates a new ruqqus-js Client instance.
   * 
   * @param {Object} [options] The client options.
   * @param {String} [options.path] Path to a config file.
   * @param {String} [options.agent] Custom `user_agent`.
   * @constructor
   */

  constructor(options={}) {
    super();

    // options = cfg ? {
    //   id: options.id || cfg.id || "",
    //   token: options.token || cfg.token || "",
    //   code: options.code || "",
    //   agent: options.agent || cfg.agent || null,
    //   refresh: options.refresh || cfg.refresh || null,
    // } : options;

    // this.keys = {
    //   code: {
    //     client_id: options.id,
    //     client_secret: options.token,
    //     grant_type: "code",
    //     code: options.code,
    //   },
    //   refresh: {
    //     client_id: options.id,
    //     client_secret: options.token,
    //     grant_type: "refresh",
    //     refresh_token: options.refresh || null,
    //     access_token: options.accessToken || null
    //   }
    // };

    this.scopes = {};
    this.id = options.id
    this.userAgent = `scroll-for-ruqqus@${options.id}`;
    
    this.domain = options.domain
    this.auth_domain = options.auth_domain

    this.access_token = options.access_token
    this.refresh_token = options.refresh_token

    this.startTime = 0;
    this.online = false,
    this.user = undefined;

    this.scopes = {
      identity: false,
      create: false,
      read: false,
      update: false,
      delete: false,
      vote: false,
      guildmaster: false
    };

    this._timeouts = new Set();
  }

  /**
   * Issues a Ruqqus API request.
   * 
   * @param {Object} options The request parameters.
   * @param {String} options.type The request method.
   * @param {String} options.path The request endpoint.
   * @param {Object} [options.auth=true] Whether or not the endpoint needs authorization keys.
   * @param {Object} [options.options={}] Extra request options.
   * @returns {Object} The request response body.
   */
  
  async APIRequest(options) {
    let methods = [ "GET", "POST" ];
    if (!options.type || !options.path || !methods.includes(options.type.toUpperCase())) {
      new OAuthError({
        message: "Invalid Request",
        code: 405
      }); return;
    }
    
    if (options.auth == undefined) options.auth = true;

    let query = options.query ? '?' : ''

    for (let [key, value] of Object.entries(options.query || {})) {
      query += `${key}=${value}&`
    }

    query.slice(0, -1)

    let requrl = options.path.startsWith(`https://${this.domain}/`)
    ? options.path
    : `https://${this.domain}/api/v1/${options.path.toLowerCase()}${query}`

    let reqbody = ''

    for (let [key, value] of Object.entries(options.options || {})) {
      reqbody += `${key}=${value}&`
    }

    reqbody = reqbody.slice(0, -1)

    let reqhead = {
      method: options.type,
      headers: {
        Authorization: `Bearer ${this.access_token}`,
        "X-User-Type": "App",
        "X-Library": "ruqqus-js",
        "X-Supports": "auth",
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: reqbody
    }
    console.log('RUQQUS FETCH START', requrl, reqhead)
    let start = Date.now()

    let resp = await fetch(requrl, reqhead)
    resp.body = await resp.text()

    try {
      resp.body = JSON.parse(resp.body)
    }
    catch (e) {
      
    }

    console.log('RUQQUS FETCH DONE (' + (Date.now() - start) + 'ms)', requrl, reqhead, resp)
    
    if (resp.ok) {
      return resp.body;
    }
    else {
      switch (resp.status) {
        case 401:
          debugger
          console.error('RUQQUS TOKENS EXPIRED')
          return this._refreshToken().then(() => this.APIRequest(options))

        case 404:
          throw new Error('Not found', resp)

        case 405:
          throw new Error('Method not allowed')

        case 413:
          throw new Error('Bad useragent')
        
        case 500:
          throw new Error('Server down')

        case 503:
          throw new Error('Server had an internal exception')

        default:
          throw new Error('Unknown response code', resp)
      }
    }
  }
  
  _refreshToken() {
    console.log('RUQQUS REFRESH', this.refresh_token, this.id)
    return fetch(`https://${this.auth_domain}/auth/${this.id}/refresh`, {
      method: 'POST',
      body: JSON.stringify({
        refresh_token: this.refresh_token
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(rsp => rsp.json())
      .then(async (resp) => {
        console.log('REFRESH COMPLETE', resp)

        if (resp.err && resp.err === 'Site does not exist') {
          return new OAuthError({message: resp.err})
        }

        if (resp.oauth_error) {
          let type;

          if (resp.oauth_error == "Invalid refresh_token") {
            type = "Refresh Token";
          } else if (resp.oauth_error == "Invalid code") {
            type = "Authcode";
          } else if (
            resp.oauth_error == "Invalid `client_id` or `client_secret`"
          ) {
            type = "ID or Client Secret";
          }

          return new OAuthError({
            message: `Invalid ${type}`,
            code: 401,
            fatal: true,
          });
        }

        resp.scopes.split(",").forEach((s) => {
          this.scopes[s] = true;
        });

        this.refresh_token = resp.refresh_token || null;
        this.access_token = resp.access_token;
        this.emit('refresh')
        let refreshIn = (resp.expires_at - 5) * 1000 - Date.now();
        console.log('Refreshing tokens in', refreshIn)
        
        setTimeout(() => {
          console.log('Refreshing tokens')
          this._refreshToken();
        }, refreshIn);

        if (!this.online) {
          if (this.scopes.identity) {
            this.user = new (require("./user.js"))(
              await this.APIRequest({ type: "GET", path: "identity" })
            );
          } else {
            this.user = undefined;
            new OAuthWarning({
              message: 'Missing "Identity" Scope',
              warning: "Client user data will be undefined!",
            });
          }

          if (!this.scopes.read)
            new OAuthWarning({
              message: 'Missing "Read" Scope',
              warning: "Post and Comment events will not be emitted!",
            });

          this.startTime = Date.now();
          this.emit("login");
          this.online = true;
        }
      })
      .catch((e) => console.error(e));
  }

  _checkEvents() {
    const timer = setTimeout(() => { this._checkEvents() }, 10000);
    this._timeouts.add(timer);
    
    if (this.eventNames().includes("post")) {
      if (!this.scopes.read) return;

      this.APIRequest({ type: "GET", path: "all/listing", options: { sort: "new" } })
        .then((resp) => {
          if (resp.error) return;

          resp.data.forEach(async p => {
            if (this.posts.cache.get(p.id)) return;

            this.posts.cache.add(posts);
          } catch (e) {
            // WIP - Proper error handling
          }

          this.posts.cache._count++;
        });
    }

    if (this.eventNames().includes("comment") && this.scopes.read) {      
      this.guilds.all.fetchComments({ cache: false })
        .then(comments => {
          try {
            comments.forEach(async comment => {
              if (this.comments.cache.get(comment.id)) return;
              if (this.comments.cache._count != 0) this.emit("comment", comment);
            });

            this.comments.cache.add(comments);
          } catch (e) {
            // WIP - Proper error handling
          }

          this.comments.cache._count++;
        });
    }
  }

  /**
   * The amount of time that has passed since Client login.
   * 
   * @returns {Number} The time, in seconds.
   */

  get uptime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
  
  get guilds() {
    return {
      /**
       * Fetches a guild with the specified name.
       * 
       * @param {String} name The guild name.
       * @returns {Guild} The guild object.
       */
    
      fetch: async (name) => {
        if (!this.scopes.read) {
          new OAuthError({
            message: 'Missing "Read" Scope',
            code: 401
          }); return;
        }
    
        return new (require("./guild.js"))(await this.APIRequest({ type: "GET", path: `guild/${name}` }), this);
      },
    
      /**
       * Fetches whether or not a guild with the specified name is available.
       * 
       * @param {String} name The guild name.
       * @returns {Boolean}
       */
    
      isAvailable: async (name) => {
        if (!name) return undefined;
        let resp = await this.APIRequest({ type: "GET", path: `board_available/${name}` });
    
        return resp.available;
      }
    }
  }

  get posts() { 
    return {
      /**
       * Fetches a post with the specified ID.
       * 
       * @param {String} id The post ID.
       * @returns {Post} The post object.
       */

      fetch: async (id) => {
        if (!this.scopes.read) {
          new OAuthError({
            message: 'Missing "Read" Scope',
            code: 401
          }); return;
        }

        return this.APIRequest({ type: "GET", path: `post/${id}` }).then(post => {
          post = new Post(post, this)
          return post;
        })
      },

      cache: new SubmissionCache()
    }
  }

  get comments() { 
    return {
      /**
       * Fetches a comment with the specified ID.
       * 
       * @param {String} id The comment ID.
       * @returns {Comment} The comment object.
       */

      fetch: async (id) => {
        if (!this.scopes.read) {
          new OAuthError({
            message: 'Missing "Read" Scope',
            code: 401
          }); return;
        }

        let comment = new (require("./comment.js"))(await this.APIRequest({ type: "GET", path: `comment/${id}` }));

        this.cache.push(comment);
        return comment;
      },

      cache: new SubmissionCache()
    }
}

  get users(){ 
    return {
      /**
       * Fetches a user with the specified username.
       * 
       * @param {String} username The user's name.
       * @returns {User} The user object.
       */

      fetch: async (username) => {
        if (!this.scopes.read) {
          new OAuthError({
            message: 'Missing "Read" Scope',
            code: 401
          }); return;
        }

        return new (require("./user.js"))(await this.APIRequest({ type: "GET", path: `user/${username}` }));
      },

      /**
       * Fetches whether or not a user with the specified username is available.
       * 
       * @param {String} username The user's name.
       * @returns {Boolean}
       */
      
      isAvailable: async (username) => {
        if (!username) return undefined;
        let resp = await this.APIRequest({ type: "GET", path: `is_available/${username}` });

        return Object.values(resp)[0];
      }
    }
  }

  get feeds() {
    return {
      frontpage: (page=0, sort='hot') => {
        if (!this.scopes.read) {
          new OAuthError({
            message: 'Missing "Read" Scope',
            code: 401
          }); return;
        }
        return this.APIRequest({type: "GET", path: 'front/listing', query: { page, sort }}).then(data => {
          return new Feed(data, this)
        })
      },

      all: (page=0, sort='hot') => {
        if (!this.scopes.read) {
          new OAuthError({
            message: 'Missing "Read" Scope',
            code: 401
          }); return;
        }
        return this.APIRequest({type: "GET", path: 'all/listing', query: { page, sort }}).then(data => {
          return new Feed(data, this)
        })
      },

      guild: (name, page=0, sort='hot') => {
        if (!this.scopes.read) {
          new OAuthError({
            message: 'Missing "Read" Scope',
            code: 401
          }); return;
        }

        return this.APIRequest({type: "GET", path: `guild/${name}/listing`, query: { page, sort }}).then(data => {
          return new Feed(data, this)
        })
      },

      user: (name, page=0, sort='hot') => {
        if (!this.scopes.read) {
          new OAuthError({
            message: 'Missing "Read" Scope',
            code: 401
          }); return;
        }

        return this.APIRequest({type: "GET", path: `user/${name}/listing`, query: { page, sort }}).then(data => {
          return new Feed(data, this)
        })
      }
    }
  }

  submitPost(board, title, url, body) {
    if (!this.scopes) {
      new OAuthError({
        message: 'Missing "Read" Scope',
        code: 401
      }); return;
    }

    return this.APIRequest({
      type: "POST",
      path: 'submit',
      options: {board, title, url, body}
    }).then(resp => {
      return new Post(resp, this)      
    })
  }
}

module.exports = Client;