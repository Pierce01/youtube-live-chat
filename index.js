const request = require('request')
const {EventEmitter} = require('events')

/**
 * The main hub for acquire live chat with the YouTube Date API.
 * @extends {EventEmitter}
 */
class YouTube extends EventEmitter {
  /**
   * @param {string} ChannelID ID of the channel to acquire with
   * @param {string} APIKey You'r API key
   */
  constructor(channelId, apiKey) {
    super()
    this.id = channelId
    this.key = apiKey
    this.getLive()
  }

  async getLive() {
    const url = 'https://www.googleapis.com/youtube/v3/search'+
      '?eventType=live'+
      '&part=id'+
      `&channelId=${this.id}`+
      '&type=video'+
      `&key=${this.key}`
    const data = await this.request(url);
    if (!data.items.length)
      this.emit('error', 'Can not find live.')
    else {
      this.liveIds = []
      for(let item in data.items) {
        this.liveIds.push(data.items[item].id.videoId)
      }
      this.getChatIds()
    }
  }

  async getChatIds() {
    if (!this.liveIds) return this.emit('error', 'Live ids are not valid.')
    this.chatIds = []
    for(let id in this.liveIds) {
      const url = 'https://www.googleapis.com/youtube/v3/videos'+
      '?part=liveStreamingDetails'+
      `&id=${this.liveIds[id]}`+
      `&key=${this.key}`
      const data = await this.request(url)
      if (!data.items.length)
          this.emit('error', `Can not find chat for stream ${this.liveIds[id]}`)
      else {
        this.chatIds.push(data.items[0].liveStreamingDetails.activeLiveChatId)
      }
    }
    if(this.chatIds.length) this.emit('ready')
  }

  /**
   * Gets live chat messages.
   * See {@link https://developers.google.com/youtube/v3/live/docs/liveChatMessages/list#response|docs}
   * @return {object}
   */
  async getChats() {
    if (!this.chatIds) return this.emit('error', 'Chat id is invalid.')
    for(let chat in this.chatIds) {
      const url = 'https://www.googleapis.com/youtube/v3/liveChat/messages'+
      `?liveChatId=${this.chatIds[chat]}`+
      '&part=id,snippet,authorDetails'+
      '&maxResults=2000'+
      `&key=${this.key}`
      this.emit('json', await this.request(url))
    }
  }

  request(url) {
    return new Promise(resolve => {
      request({
        url: url,
        method: 'GET',
        json: true,
      }, (error, response, data) => {
        if (error)
          this.emit('error', error)
        else if (response.statusCode !== 200)
          this.emit('error', data)
        else
          resolve(data)
      })
    })
  }

  /**
   * Gets live chat messages at regular intervals.
   * @param {number} delay Interval to get live chat messages
   * @fires YouTube#message
   */
  listen(delay) {
    let lastRead = 0, time = 0
    this.interval = setInterval(() => this.getChats(), delay)
    this.on('json', data => {
      for (const item of data.items) {
        time = new Date(item.snippet.publishedAt).getTime()
        if (lastRead < time) {
          lastRead = time
          /**
          * Emitted whenever a new message is recepted.
          * See {@link https://developers.google.com/youtube/v3/live/docs/liveChatMessages#resource|docs}
          * @event YouTube#message
          * @type {object}
          */
          this.emit('message', item)
        }
      }
    })
  }

  /**
   * Stops getting live chat messages at regular intervals.
   */
  stop() {
    clearInterval(this.interval)
  }
}

module.exports = YouTube
