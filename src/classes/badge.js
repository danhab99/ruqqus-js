class Badge {
  constructor(data, client) {
    this.client = client
    Object.assign(this, this.formatData(data));
  }

  formatData(resp) {
    if (!resp.name) return undefined;
    
    return {
      name: resp.name,
      description: resp.text,
      url: resp.url,
      icon_url: resp.icon_url,
      created_at: resp.created_utc
    }
  }
}

module.exports = Badge;