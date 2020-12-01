const { OAuthError } = require("./error.js");

const User = require('./user')
const Post = require('./post')

class Comment {
  constructor(data, client) {
    this.client = client
    Object.assign(this, this.formatData(data));
  }

  formatData(resp) {
    if (!resp.id) return undefined;
    
    return {
      author_username: resp.author_name, // This is ridiculous.
      content: {
        text: resp.body,
        html: resp.body_html
      },
      votes: {
        score: resp.score,
        upvotes: resp.upvotes,
        downvotes: resp.downvotes
      },
      id: resp.id,
      full_id: resp.fullname,
      link: resp.permalink,
      full_link: `https://ruqqus.com${resp.permalink}`,
      parent: new (require("./parent.js"))(resp.parent),
      created_at: resp.created_utc,
      edited_at: resp.edited_utc,
      chain_level: resp.level,
      awards: resp.award_count,
      flags: {
        archived: resp.is_archived,
        banned: resp.is_banned,
        deleted: resp.is_deleted,
        nsfw: resp.is_nsfw,
        nsfl: resp.is_nsfl,
        offensive: resp.is_offensive,
        edited: resp.edited_utc > 0
      },
      post: new Post(resp.post, this.client)
    }
  }

  /**
   * Submits a reply to the comment.
   * 
   * @param {String} body The body of the reply.
   */

  reply(body) {
    if (!this.client.scopes.create) {
      throw new OAuthError({
        message: 'Missing "Create" Scope',
        code: 401
      }); 
    }

    if (!body || body == " ") {
      throw new OAuthError({
        message: "No Comment Body Provided!",
        code: 405
      }); 
    }

    return this.client.APIRequest({ type: "POST", path: "comment", options: { parent_fullname: `t3_${this.id}`, body: body } })
  }

  /**
   * Upvotes the comment.
   * 
   * @deprecated
   */

  upvote() {
    if (!this.client.scopes.vote) {
      throw new OAuthError({
        message: 'Missing "Vote" Scope',
        code: 401
      }); 
    }
    
    return this.client.APIRequest({ type: "POST", path: `vote/comment/${this.id}/1` });
  }

  /** 
   * Downvotes the comment.
   * 
   * @deprecated
   */

  downvote() {
    if (!this.client.scopes.vote) {
      throw new OAuthError({
        message: 'Missing "Vote" Scope',
        code: 401
      }); 
    }

    return this.client.APIRequest({ type: "POST", path: `vote/comment/${this.id}/-1` });
  }

  /**
   * Removes the client's vote from the comment.
   * 
   * @deprecated
   */

  removeVote() {
    if (!this.client.scopes.vote) {
      throw new OAuthError({
        message: 'Missing "Vote" Scope',
        code: 401
      }); 
    }
    
    return this.client.APIRequest({ type: "POST", path: `vote/comment/${this.id}/0` });
  }

  /**
   * Deletes the comment.
   */

  delete() {
    if (!this.client.scopes.delete) {
      throw new OAuthError({
        message: 'Missing "Delete" Scope',
        code: 401
      }); 
    }

    return this.client.APIRequest({ type: "POST", path: `delete/comment/${this.id}` })
      .then((resp) => {
        if (resp.error) throw new OAuthError({
          message: "Comment Deletion Failed",
          code: 403
        });
      });
  }
}

module.exports = Comment;