const { OAuthError } = require("./error.js");

const Badge = require('./badge')

class User {
  constructor(data, client) {
    this.client = client
    Object.assign(this, this.formatData(data));
  }

  formatData(resp) {
    if (!resp.id) return undefined;

    if (resp.is_banned) {
      return {
        username: resp.username,
        id: resp.id,
        link: resp.permalink,
        full_link: `https://ruqqus.com${resp.permalink}`,
        ban_reason: resp.ban_reason,
      }
    }
    
    return {
      username: resp.username,
      title: resp.title ? {
        name: resp.title.text.startsWith(",") ? resp.title.text.split(", ")[1] : resp.title.text,
        id: resp.title.id,
        kind: resp.title.kind,
        color: resp.title.color
      } : null,
      bio: {
        text: resp.bio,
        html: resp.bio_html
      },
      stats: {
        posts: resp.post_count,
        post_rep: resp.post_rep,
        comments: resp.comment_count,
        comment_rep: resp.comment_rep
      },
      id: resp.id,
      full_id: `t1_${resp.id}`,
      link: resp.permalink,
      full_link: `https://ruqqus.com${resp.permalink}`,
      avatar_url: resp.profile_url.startsWith("/assets") ? `https://ruqqus.com${resp.profile_url}` : resp.profile_url,
      banner_url: resp.banner_url.startsWith("/assets") ? `https://ruqqus.com${resp.banner_url}` : resp.banner_url,
      created_at: resp.created_utc,
      flags: {
        banned: resp.is_banned
      },
      badges: 
        resp.badges.map(badge => {
          return new Badge(badge, this.client);
        }),
    }
  }

  /**
   * Fetches an array of post objects from the user.
   * 
   * @param {Object} [options] The post sorting parameters.
   * @param {Number} [options.page=1] The page index to fetch posts from.
   * @param {Number} [options.limit=24] The amount of post objects to return.
   * @returns {Array} The post objects.
   */

  async fetchPosts(options) {
    const Post = require("./post.js");

    if (!this.client.scopes.read) {
      throw new OAuthError({
        message: 'Missing "Read" Scope',
        code: 401
      }); 
    }

    let posts = [];
    
    let resp = await this.client.APIRequest({ type: "GET", path: `user/${this.username}/listing`, options: { page: options && options.page ? options.page : 1 } });
    if (options && options.limit) resp.data.splice(options.limit, resp.data.length - options.limit);

    for await (let post of resp.data) {
      posts.push(new Post(post));
    }

    return posts;
  }

  /**
   * Fetches an array of comment objects from the user.
   * 
   * @param {Object} [options] The comment sorting parameters.
   * @param {Number} [options.page=1] The page index to fetch comments from.
   * @param {Number} [options.limit=24] The amount of comment objects to return.
   * @returns {Array} The comment objects.
   */

  async fetchComments(limit, page) {
    const Comment = require("./comment.js");

    if (!this.client.scopes.read) {
      throw new OAuthError({
        message: 'Missing "Read" Scope',
        code: 401
      }); 
    }

    let comments = [];

    let resp = await this.client.APIRequest({ type: "GET", path: `user/${this.username}/comments`, options: { page: options && options.page ? options.page : 1 } });
    if (options && options.limit) resp.data.splice(options.limit, resp.data.length - options.limit);
    
    for await (let comment of resp.data) {
      comments.push(new Comment(comment));
    }

    return comments;
  }
}

module.exports = User;