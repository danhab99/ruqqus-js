const { OAuthError } = require("./error.js");
const User = require("./user.js")
const Guild = require("./guild.js")


class Post {
  constructor(data, client) {
    Object.assign(this, this.formatData(data));
    this.client = client
  }
  
  formatData(resp) {
    if (!resp.id) return undefined;

    return {
      author: new User(resp.author, this.client),
      content: {
        title: resp.title,
        body: {
          text: resp.body,
          html: resp.body_html
        },
        domain: resp.domain,
        url: resp.url,
        thumbnail: resp.thumb_url,
        embed: resp.embed_url
      },
      votes: {
        score: resp.score,
        upvotes: resp.upvotes,
        downvotes: resp.downvotes,
        voted: resp.voted
      },
      id: resp.id,
      full_id: resp.fullname,
      link: resp.permalink,
      full_link: `https://ruqqus.com${resp.permalink}`,
      created_at: resp.created_utc,
      edited_at: resp.edited_utc,
      flags: {
        archived: resp.is_archived,
        banned: resp.is_banned,
        deleted: resp.is_deleted,
        nsfw: resp.is_nsfw,
        nsfl: resp.is_nsfl,
        edited: resp.edited_utc > 0,
        yanked: resp.original_guild ? true : false
      },
      guild: new Guild(resp.guild, this.client),
      original_guild: resp.original_guild ? new Guild(resp.original_guild, this.client) : null
    }
  }

  /**
   * Submits a comment to the post.
   * 
   * @param {String} body The body of the comment.
   */

  comment(body) {
    if (!this.client.scopes.create) { 
      throw new OauthError({
        message: 'Missing "Create" Scope',
        code: 401
      });
    }

    if (!body || body == " ") throw new OauthError({
      message: "No Comment Body Provided!",
      code: 405
    });

    return this.client.APIRequest({ type: "POST", path: "comment", options: { parent_fullname: `t2_${this.id}`, body: body } });
  }

  /**
   * Upvotes the post.
   * 
   * @deprecated
   */

  upvote() {
    if (!this.client.scopes.vote) { 
      throw new OauthError({
        message: 'Missing "Vote" Scope',
        code: 401
      });
    }

    return this.client.APIRequest({ type: "POST", path: `vote/post/${this.id}/1` })
      .then(() => this.client.posts.fetch(this.id))
  }
  
  /**
   * Downvotes the post.
   * 
   * @deprecated
   */

  downvote() {
    if (!this.client.scopes.vote) {
      throw new OauthError({
        message: 'Missing "Vote" Scope',
        code: 401
      }); 
    }

    return this.client.APIRequest({ type: "POST", path: `vote/post/${this.id}/-1` })
      .then(() => this.client.posts.fetch(this.id))
  }

  /**
   * Removes the this.client's vote from the post.
   * 
   * @deprecated
   */

  removeVote() {
    if (!this.client.scopes.vote) {
      throw new OauthError({
        message: 'Missing "Vote" Scope',
        code: 401
      });
    }

    return this.client.APIRequest({ type: "POST", path: `vote/post/${this.id}/0` })
      .then(() => this.client.posts.fetch(this.id))
  }

  /**
   * Deletes the post.
   */

  delete() {
    if (!this.client.scopes.delete) {
      throw new OauthError({
        message: 'Missing "Delete" Scope',
        code: 401 
      });
    }
    
    this.client.APIRequest({ type: "POST", path: `delete_post/${this.id}` })
      .then((resp) => {
        if (resp.error) throw new OauthError({
          message: "Post Deletion Failed",
          code: 403
        });
      });
  }

  /**
   * Toggles post NSFW.
   */

  toggleNSFW() {
    if (!this.client.scopes.update) {
      throw new OauthError({
        message: 'Missing "Update" Scope',
        code: 401 
      });
    }

    this.client.APIRequest({ type: "POST", path: `toggle_post_nsfw/${this.id}` })
      .then((resp) => {
        if (resp.error) throw new OauthError({
          message: "Post Update Failed",
          code: 403
        });
      });
  }

  /**
   * Toggles post NSFL.
   */

  toggleNSFL() {
    if (!this.client.scopes.update) {
      throw new OauthError({
        message: 'Missing "Update" Scope',
        code: 401 
      });
    }

    this.client.APIRequest({ type: "POST", path: `toggle_post_nsfl/${this.id}` })
      .then((resp) => {
        if (resp.error) throw new OauthError({
          message: "Post Update Failed",
          code: 403
        });
      });
  }
}

module.exports = Post;